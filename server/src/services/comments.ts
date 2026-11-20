import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { and, desc, eq, isNull } from "drizzle-orm";
import { comments, feeds, users } from "../db/schema";
import { profileAsync } from "../core/server-timing";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";
export function CommentService(): Hono {
    const app = new Hono();
    // 管理员：获取所有待审核评论
    app.get('/admin/pending', async (c: AppContext) => {
        if (!c.get('admin')) {
            return c.text('Forbidden', 403);
        }
        const db = c.get('db');
        const pendingComments = await db.query.comments.findMany({
            where: eq(comments.approved, 0),
            columns: {
                guestEmail: false,
            },
            with: {
                feed: {
                    columns: {
                        id: true,
                        title: true,
                    },
                },
                user: {
                    columns: {
                        id: true,
                        username: true,
                        avatar: true,
                        permission: true,
                    },
                },
            },
            orderBy: [desc(comments.createdAt)],
        });
        return c.json(pendingComments);
    });
    // 管理员：批准评论
    app.post('/admin/:id/approve', async (c: AppContext) => {
        if (!c.get('admin')) {
            return c.text('Forbidden', 403);
        }
        const db = c.get('db');
        const id = Number.parseInt(c.req.param('id'), 10);
        if (!Number.isSafeInteger(id) || id <= 0) {
            return c.text('Invalid comment ID', 400);
        }
        const comment = await db.query.comments.findFirst({
            where: and(
                eq(comments.id, id),
                eq(comments.approved, 0),
            ),
        });
        if (!comment) {
            return c.text('Comment not found', 404);
        }
        await db.update(comments)
            .set({ approved: 1 })
            .where(eq(comments.id, id));
        return c.json({ success: true });
    });
    // 公共：获取已审核通过的评论
    app.get('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const feedId = parseInt(c.req.param('feed'));
        const comment_list = await profileAsync(c, 'comment_list_db', () => db.query.comments.findMany({
            where: and(
                eq(comments.feedId, feedId),
                eq(comments.approved, 1),
            ),
            columns: {
                feedId: false,
                userId: false,
                guestEmail: false,
            },
            with: {
                user: {
                    columns: {
                        id: true,
                        username: true,
                        avatar: true,
                        permission: true,
                    },
                },
            },
            orderBy: [desc(comments.createdAt)],
        }));
        const result = comment_list.map((c: any) => {
            if (c.user) {
                return c;
            }
            const { user, ...rest } = c;
            return {
                ...rest,
                user: null,
                guestName: rest.guestName || "",
                guestWebsite: rest.guestWebsite || "",
            };
        });
        return c.json(result);
    });
    // 创建评论
    app.post('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const env = c.get('env');
        const serverConfig = c.get('serverConfig');
        const clientConfig = c.get('clientConfig');
        const uid = c.get('uid');
        const admin = c.get('admin');
        const feedId = parseInt(c.req.param('feed'));
        const enable = await profileAsync(c, 'comment_create_config', () =>
            clientConfig.getOrDefault('comment.enabled', true)
        );
        if (!enable && !admin) {
            return c.text('Comment Disabled', 403);
        }
        const body = await profileAsync(c, 'comment_create_parse', () => c.req.json());
        const { content, guestName, guestEmail, guestWebsite } = body;
        if (!content || typeof content !== 'string' || !content.trim()) {
            return c.text('Content is required', 400);
        }
        const exist = await profileAsync(c, 'comment_create_feed', () =>
            db.query.feeds.findFirst({
                where: eq(feeds.id, feedId),
            })
        );
        if (!exist) {
            return c.text('Feed not found', 400);
        }
        // 登录用户评论
        if (uid) {
            const user = await profileAsync(c, 'comment_create_user', () =>
                db.query.users.findFirst({
                    where: eq(users.id, uid),
                })
            );
            if (!user) {
                return c.text('User not found', 400);
            }
            // 普通用户待审核，管理员直接公开
            await db.insert(comments).values({
                feedId,
                userId: uid,
                content: content.trim(),
                approved: admin ? 1 : 0,
            });
            // 只有管理员直接公开的评论才发送公开评论通知
            if (admin) {
                const {
                    webhookUrl,
                    webhookMethod,
                    webhookContentType,
                    webhookHeaders,
                    webhookBodyTemplate,
                } = await profileAsync(c, 'comment_create_webhook_config', () =>
                    resolveWebhookConfig(serverConfig, env)
                );
                const frontendUrl = new URL(c.req.url).origin;
                try {
                    await profileAsync(c, 'comment_create_notify', () =>
                        notify(
                            webhookUrl || "",
                            {
                                event: "comment.created",
                                message: `${frontendUrl}/feed/${feedId}\n${user.username} 评论了: ${exist.title}\n${content}`,
                                title: exist.title || "",
                                url: `${frontendUrl}/feed/${feedId}`,
                                username: user.username,
                                content,
                            },
                            {
                                method: webhookMethod,
                                contentType: webhookContentType,
                                headers: webhookHeaders,
                                bodyTemplate: webhookBodyTemplate,
                            },
                        )
                    );
                } catch (error) {
                    console.error("Failed to send comment webhook", error);
                }
            }
            return c.text('OK');
        }
        // 游客评论：必须等待管理员审核
        if (!guestName || typeof guestName !== 'string' || !guestName.trim()) {
            return c.text('Guest name is required', 400);
        }
        await db.insert(comments).values({
            feedId,
            userId: null,
            content: content.trim(),
            guestName: guestName.trim(),
            guestEmail: typeof guestEmail === 'string' ? guestEmail.trim() : "",
            guestWebsite: typeof guestWebsite === 'string' ? guestWebsite.trim() : "",
            approved: 0,
        });
        return c.text('OK');
    });
    // 删除评论：管理员可删除任何评论，普通用户只能删除自己的评论
    app.delete('/:id', async (c: AppContext) => {
        const db = c.get('db');
        const uid = c.get('uid');
        const admin = c.get('admin');
        if (uid === undefined) {
            return c.text('Unauthorized', 401);
        }
        const id_num = parseInt(c.req.param('id'));
        if (!Number.isSafeInteger(id_num) || id_num <= 0) {
            return c.text('Invalid comment ID', 400);
        }
        const comment = await profileAsync(c, 'comment_delete_lookup', () =>
            db.query.comments.findFirst({
                where: eq(comments.id, id_num),
            })
        );
        if (!comment) {
            return c.text('Not found', 404);
        }
        if (!admin && comment.userId !== uid) {
            return c.text('Permission denied', 403);
        }
        await db.delete(comments).where(eq(comments.id, id_num));
        return c.text('OK');
    });
    return app;
}
