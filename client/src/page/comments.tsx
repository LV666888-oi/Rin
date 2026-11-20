import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import Loading from "react-loading";
import { client } from "../app/runtime";
import { FlatPanel } from "@rin/ui";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import type { PendingComment } from "../api/client";

export function CommentsPage() {
  useTranslation();
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();

  const [comments, setComments] = useState<PendingComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<number | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);

    const { data, error } = await client.comment.pending();

    if (error) {
      showAlert(error.value as string);
    }

    if (data) {
      setComments(data);
    }

    setLoading(false);
  }, [showAlert]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function approveComment(id: number) {
    if (processing !== null) return;

    setProcessing(id);

    const { error } = await client.comment.approve(id);

    if (error) {
      showAlert(error.value as string);
    } else {
      setComments((previous) =>
        previous.filter((comment) => comment.id !== id)
      );
      showAlert("评论已批准并公开");
    }

    setProcessing(null);
  }

  async function deleteComment(id: number) {
    if (processing !== null) return;

    if (!window.confirm("确定要删除这条评论吗？此操作不可撤销。")) {
      return;
    }

    setProcessing(id);

    const { error } = await client.comment.delete(id);

    if (error) {
      showAlert(error.value as string);
    } else {
      setComments((previous) =>
        previous.filter((comment) => comment.id !== id)
      );
      showAlert("评论已删除");
    }

    setProcessing(null);
  }

  function formatDate(value: string | number) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "时间未知";
    }

    return date.toLocaleString();
  }

  return (
    <>
      <Helmet>
        <title>{`评论审核 - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content="评论审核" />
        <meta property="og:image" content={siteConfig.avatar} />
      </Helmet>

      <div className="mt-2 flex flex-col gap-4 t-primary sm:gap-6">
        <FlatPanel className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme/70">
                ADMINISTRATION
              </p>
              <h1 className="mt-2 text-xl font-semibold">
                评论审核
              </h1>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                审核游客和普通用户提交的评论，批准后才会公开显示。
              </p>
            </div>

            <button
              type="button"
              onClick={loadComments}
              disabled={loading}
              className="rounded-xl bg-theme px-4 py-2.5 text-sm text-white transition hover:bg-theme-hover disabled:opacity-50"
            >
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
          </div>

          <div className="mt-5 flex items-center gap-2 border-t border-black/5 pt-4 dark:border-white/5">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              待审核评论
            </span>
            <span className="rounded-lg bg-theme/10 px-2.5 py-1 text-sm font-semibold text-theme">
              {comments.length}
            </span>
          </div>
        </FlatPanel>

        {loading ? (
          <FlatPanel className="flex items-center justify-center gap-3 p-10">
            <Loading type="spin" height={22} width={22} />
            <span className="text-sm text-neutral-500">
              正在加载评论...
            </span>
          </FlatPanel>
        ) : comments.length === 0 ? (
          <FlatPanel className="p-10 text-center">
            <div className="text-3xl">✓</div>
            <p className="mt-3 font-medium">目前没有待审核评论</p>
            <p className="mt-2 text-sm text-neutral-500">
              新提交的评论会显示在这里。
            </p>
          </FlatPanel>
        ) : (
          <div className="flex flex-col gap-4">
            {comments.map((comment) => {
              const name =
                comment.user?.username ||
                comment.guestName ||
                "游客";

              return (
                <FlatPanel
                  key={comment.id}
                  className="overflow-hidden p-4 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{name}</span>
                        <span className="rounded-md bg-yellow-500/10 px-2 py-1 text-xs text-yellow-600 dark:text-yellow-400">
                          待审核
                        </span>
                      </div>

                      <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        文章：{comment.feed?.title || "文章已不存在"}
                      </p>

                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        提交时间：{formatDate(comment.createdAt)}
                      </p>
                    </div>

                    <span className="text-xs text-neutral-400">
                      #{comment.id}
                    </span>
                  </div>

                  <div className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-secondary p-4 text-sm leading-7">
                    {comment.content}
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => deleteComment(comment.id)}
                      disabled={processing !== null}
                      className="rounded-xl border border-red-500/30 px-4 py-2.5 text-sm text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {processing === comment.id
                        ? "处理中..."
                        : "删除评论"}
                    </button>

                    <button
                      type="button"
                      onClick={() => approveComment(comment.id)}
                      disabled={processing !== null}
                      className="rounded-xl bg-theme px-5 py-2.5 text-sm text-white transition hover:bg-theme-hover disabled:opacity-50"
                    >
                      {processing === comment.id
                        ? "处理中..."
                        : "批准并公开"}
                    </button>
                  </div>
                </FlatPanel>
              );
            })}
          </div>
        )}
      </div>

      <AlertUI />
    </>
  );
}
