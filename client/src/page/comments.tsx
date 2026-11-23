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
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);

    try {
      const { data, error } = await client.comment.pending();

      if (error) {
        showAlert(error.value as string);
      }

      if (data) {
        setComments(data);
      }
    } catch (error) {
      showAlert("加载评论失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function approveComment(id: number) {
    if (processing !== null || bulkDeleting) return;

    setProcessing(id);

    try {
      const { error } = await client.comment.approve(id);

      if (error) {
        showAlert(error.value as string);
      } else {
        setComments((previous) =>
          previous.filter((comment) => comment.id !== id)
        );
        showAlert("评论已批准并公开");
      }
    } catch (error) {
      showAlert("批准评论失败，请稍后重试");
    } finally {
      setProcessing(null);
    }
  }

  async function deleteComment(id: number) {
    if (processing !== null || bulkDeleting) return;

    if (!window.confirm("确定要删除这条评论吗？此操作不可撤销。")) {
      return;
    }

    setProcessing(id);

    try {
      const { error } = await client.comment.delete(id);

      if (error) {
        showAlert(error.value as string);
      } else {
        setComments((previous) =>
          previous.filter((comment) => comment.id !== id)
        );
        showAlert("评论已删除");
      }
    } catch (error) {
      showAlert("删除评论失败，请稍后重试");
    } finally {
      setProcessing(null);
    }
  }

  async function deleteAllPendingComments() {
    if (bulkDeleting || processing !== null || comments.length === 0) {
      return;
    }

    setBulkDeleting(true);

    try {
      const { data, error } = await client.comment.deletePending();

      if (error) {
        showAlert(error.value as string);
        return;
      }

      setShowBulkConfirm(false);

      const deletedCount = data?.deletedCount ?? 0;

      showAlert(`已删除 ${deletedCount} 条待审核评论`);

      await loadComments();
    } catch (error) {
      showAlert("批量删除失败，请稍后重试");
    } finally {
      setBulkDeleting(false);
    }
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(true)}
                disabled={
                  loading ||
                  bulkDeleting ||
                  processing !== null ||
                  comments.length === 0
                }
                className="rounded-xl border border-red-500/40 px-4 py-2.5 text-sm text-red-500 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                全部拒审
              </button>

              <button
                type="button"
                onClick={loadComments}
                disabled={loading || bulkDeleting || processing !== null}
                className="rounded-xl bg-theme px-4 py-2.5 text-sm text-white transition hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "正在刷新..." : "刷新列表"}
              </button>
            </div>
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

            <p className="mt-3 font-medium">
              目前没有待审核评论
            </p>

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

              const guestEmail = comment.user
                ? null
                : comment.guestEmail?.trim() || null;

              return (
                <FlatPanel
                  key={comment.id}
                  className="overflow-hidden p-4 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">
                          {name}
                        </span>

                        <span className="rounded-md bg-yellow-500/10 px-2 py-1 text-xs text-yellow-600 dark:text-yellow-400">
                          待审核
                        </span>
                      </div>

                      {guestEmail && (
                        <p className="mt-2 break-all text-sm text-theme">
                          游客邮箱：{guestEmail}
                        </p>
                      )}

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
                      disabled={processing !== null || bulkDeleting}
                      className="rounded-xl border border-red-500/30 px-4 py-2.5 text-sm text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {processing === comment.id
                        ? "处理中..."
                        : "删除评论"}
                    </button>

                    <button
                      type="button"
                      onClick={() => approveComment(comment.id)}
                      disabled={processing !== null || bulkDeleting}
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

      {showBulkConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !bulkDeleting
            ) {
              setShowBulkConfirm(false);
            }
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bulk-delete-title"
            aria-describedby="bulk-delete-description"
            className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-xl text-red-500">
                !
              </div>

              <h2
                id="bulk-delete-title"
                className="text-lg font-semibold"
              >
                批量拒审确认
              </h2>
            </div>

            <p
              id="bulk-delete-description"
              className="mt-5 text-sm leading-7 text-neutral-600 dark:text-neutral-300"
            >
              确定要拒绝并删除当前全部
              <span className="mx-1 font-semibold text-red-500">
                {comments.length}
              </span>
              条等待审核中的评论吗？
              <br />
              此操作不可撤销，已批准的评论不会受到影响。
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                disabled={bulkDeleting}
                className="rounded-xl border border-black/10 px-5 py-2.5 text-sm transition hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
              >
                取消
              </button>

              <button
                type="button"
                onClick={deleteAllPendingComments}
                disabled={bulkDeleting}
                className="flex min-w-[112px] items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {bulkDeleting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>正在删除...</span>
                  </>
                ) : (
                  "确认删除"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertUI />
    </>
  );
}
