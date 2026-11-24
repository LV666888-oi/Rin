import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { and, desc, eq } from "drizzle-orm";
import { comments, feeds, users } from "../db/schema";
import { profileAsync } from "../core/server-timing";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "./config-helpers";

const MAX_COMMENT_LENGTH = 200;

function getCharacterLength(value: string): number {
    return Array.from(value).length;
}

function exceedsLimit(value: string): boolean {
    return getCharacterLength(value) > MAX_COMMENT_LENGTH;
}

async function verifyCommentTurnstile(
    secret: string,
    token: string,
    remoteIp?: string
): Promise<boolean> {
    try {
        const body = new URLSearchParams({
            secret,
            response: token,
        });

        if (remoteIp) {
            body.append("remoteip", remoteIp);
        }

        const response = await fetch(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
            }
        );

        if (!response.ok) return false;

        const result = await response.json() as {
            success?: boolean;
            action?: string;
        };

        return result.success === true && result.action === "comment";
    } catch (error) {
        console.error("Comment Turnstile verification failed", error);
        return false;
    }
}

export function CommentService(): Hono {
    const app = new Hono();

    // Admin: Get all pending comments
    app.get('/admin/pending', async (c: AppContext) => {
        if (!c.get('admin')) {
            return c.text('Forbidden', 403);
        }

        const db = c.get('db');

        const pendingComments = await db.query.comments.findMany({
            where: eq(comments.approved, 0),
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

    // Admin: Delete all pending comments
    app.delete('/admin/pending', async (c: AppContext) => {
        if (!c.get('admin')) {
            return c.text('Forbidden', 403);
        }

        const db = c.get('db');

        const deleted = await db.delete(comments)
            .where(eq(comments.approved, 0))
            .returning({
                id: comments.id,
            });

        return c.json({
            success: true,
            deletedCount: deleted.length,
        });
    });

    // Admin: Approve a comment
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

    // Public: Get approved comments
    app.get('/:feed', async (c: AppContext) => {
        const db = c.get('db');
        const feedId = parseInt(c.req.param('feed'));
        const isAdmin = Boolean(c.get('admin'));

        const comment_list = await profileAsync(c, 'comment_list_db', () =>
            db.query.comments.findMany({
                where: and(
                    eq(comments.feedId, feedId),
                    eq(comments.approved, 1),
                ),
                columns: {
                    feedId: false,
                    userId: false,
                    ...(!isAdmin ? { guestEmail: false } : {}),
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
            })
        );

        const result = comment_list.map((comment: any) => {
            if (comment.user) {
                return comment;
            }

            const { user, ...rest } = comment;

            return {
                ...rest,
                user: null,
                guestName: rest.guestName || "",
                guestWebsite: rest.guestWebsite || "",
            };
        });

        return c.json(result);
    });

    // Create a comment
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

        const body = await profileAsync(c, 'comment_create_parse', () =>
            c.req.json()
        );

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return c.text('Invalid comment data', 400);
        }

        const {
            content,
            guestName,
            guestEmail,
            guestWebsite,
            turnstileToken,
        } = body;

        // Validate comment content
        if (!content || typeof content !== 'string' || !content.trim()) {
            return c.text('Content is required', 400);
        }

        if (exceedsLimit(content)) {
            return c.text('评论内容不能超过200个字符', 400);
        }

        // Validate guest name
        if (
            guestName !== undefined &&
            guestName !== null &&
            typeof guestName !== 'string'
        ) {
            return c.text('Invalid guest name', 400);
        }

        if (typeof guestName === 'string' && exceedsLimit(guestName)) {
            return c.text('用户名不能超过200个字符', 400);
        }

        // Validate guest email
        if (
            guestEmail !== undefined &&
            guestEmail !== null &&
            typeof guestEmail !== 'string'
        ) {
            return c.text('Invalid guest email', 400);
        }

        if (typeof guestEmail === 'string' && exceedsLimit(guestEmail)) {
            return c.text('邮箱不能超过200个字符', 400);
        }

        const exist = await profileAsync(c, 'comment_create_feed', () =>
            db.query.feeds.findFirst({
                where: eq(feeds.id, feedId),
            })
        );

        if (!exist) {
            return c.text('Feed not found', 400);
        }

        // Non-admin users must pass Turnstile verification
        if (!admin) {
            if (
                !turnstileToken ||
                typeof turnstileToken !== 'string'
            ) {
                return c.text('Human verification is required', 403);
            }

            const turnstileSecret = env.TURNSTILE_SECRET_KEY;

            if (!turnstileSecret) {
                console.error("TURNSTILE_SECRET_KEY is missing");
                return c.text('Verification service unavailable', 500);
            }

            const remoteIp = c.req.header('CF-Connecting-IP');

            const verified = await verifyCommentTurnstile(
                turnstileSecret,
                turnstileToken,
                remoteIp
            );

            if (!verified) {
                return c.text('Human verification failed', 403);
            }
        }

        // Logged-in user comment
        if (uid) {
            const user = await profileAsync(c, 'comment_create_user', () =>
                db.query.users.findFirst({
                    where: eq(users.id, uid),
                })
            );

            if (!user) {
                return c.text('User not found', 400);
            }

            // Validate registered username
            if (
                typeof user.username !== 'string' ||
                exceedsLimit(user.username)
            ) {
                return c.text('用户名不能超过200个字符', 400);
            }

            await db.insert(comments).values({
                feedId,
                userId: uid,
                content: content.trim(),
                approved: admin ? 1 : 0,
            });

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

        // Guest comment: requires administrator approval
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

    // Delete comment
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
