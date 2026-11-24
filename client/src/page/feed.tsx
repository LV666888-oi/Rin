import type { Feed } from "@rin/api";
import { Modal } from "@rin/ui";
import { useContext, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import Popup from "reactjs-popup";
import { Link, useLocation } from "wouter";
import { useAlert, useConfirm } from "../components/dialog";
import { HashTag } from "../components/hashtag";
import { ImageWithFallback } from "../components/image-with-fallback";
import { Waiting } from "../components/loading";
import { Markdown } from "../components/markdown";
import { client } from "../app/runtime";
import { ClientConfigContext } from "../state/config";
import { ProfileContext } from "../state/profile";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import { timeago } from "../utils/timeago";
import { Button } from "../components/button";
import { Tips } from "../components/tips";
import mermaid from "mermaid";
import { AdjacentSection } from "../components/adjacent_feed.tsx";
import { stripImageUrlMetadata } from "../utils/image-upload";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const TURNSTILE_SITE_KEY = "0x4AAAAAAGKowduOW9jDZSdd";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const MAX_COMMENT_LENGTH = 200;

function getCharacterLength(value: string) {
  return Array.from(value).length;
}

function limitCharacters(value: string) {
  return Array.from(value).slice(0, MAX_COMMENT_LENGTH).join("");
}

function extractFirstMarkdownImageUrl(content: string) {
  const match = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/.exec(content);
  if (!match) {
    return undefined;
  }
  return stripImageUrlMetadata(match[1]);
}

export function FeedPage({
  id,
  TOC,
  clean,
}: {
  id: string;
  TOC: () => JSX.Element;
  clean: (id: string) => void;
}) {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const profile = useContext(ProfileContext);
  const [feed, setFeed] = useState<Feed>();
  const [error, setError] = useState<string>();
  const [headImage, setHeadImage] = useState<string>();
  const ref = useRef("");
  const [, setLocation] = useLocation();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [top, setTop] = useState<number>(0);
  const config = useContext(ClientConfigContext);
  const counterEnabled = config.getBoolean("counter.enabled");
  const hasAISummary = Boolean(feed?.ai_summary?.trim());
  const showAISummaryState =
    feed?.ai_summary_status === "pending" ||
    feed?.ai_summary_status === "processing" ||
    feed?.ai_summary_status === "failed";
  const hashtags = Array.isArray(feed?.hashtags) ? feed.hashtags : [];

  function deleteFeed() {
    showConfirm(
      t("article.delete.title"),
      t("article.delete.confirm"),
      () => {
        if (!feed) return;
        client.feed.delete(feed.id).then(({ error }) => {
          if (error) {
            showAlert(error.value as string);
          } else {
            showAlert(t("delete.success"));
            setLocation("/");
          }
        });
      }
    );
  }

  function topFeed() {
    const isUnTop = !(top > 0);
    const topNew = isUnTop ? 1 : 0;

    showConfirm(
      isUnTop ? t("article.top.title") : t("article.untop.title"),
      isUnTop ? t("article.top.confirm") : t("article.untop.confirm"),
      () => {
        if (!feed) return;
        client.feed.setTop(feed.id, topNew).then(({ error }) => {
          if (error) {
            showAlert(error.value as string);
          } else {
            showAlert(
              isUnTop
                ? t("article.top.success")
                : t("article.untop.success")
            );
            setTop(topNew);
          }
        });
      }
    );
  }

  useEffect(() => {
    if (ref.current == id) return;

    setFeed(undefined);
    setError(undefined);
    setHeadImage(undefined);

    client.feed.get(id).then(({ data, error }) => {
      if (error) {
        setError(error.value as string);
      } else if (data && typeof data !== "string") {
        setTimeout(() => {
          setFeed(data as any);
          setTop(data.top || 0);

          const headImageUrl = extractFirstMarkdownImageUrl(data.content);
          if (headImageUrl) {
            setHeadImage(headImageUrl);
          }

          clean(id);
        }, 0);
      }
    });

    ref.current = id;
  }, [id]);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
    });

    mermaid
      .run({
        suppressErrors: true,
        nodes: document.querySelectorAll("pre.mermaid_default"),
      })
      .then(() => {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
        });

        mermaid.run({
          suppressErrors: true,
          nodes: document.querySelectorAll("pre.mermaid_dark"),
        });
      });
  }, [feed]);

  return (
    <Waiting for={feed || error}>
      {feed && (
        <Helmet>
          <title>{`${feed.title ?? "Unnamed"} - ${siteConfig.name}`}</title>
          <meta property="og:site_name" content={siteName} />
          <meta property="og:title" content={feed.title ?? ""} />
          <meta property="og:image" content={headImage ?? siteConfig.avatar} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={document.URL} />
          <meta
            name="og:description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
          <meta name="author" content={feed.user.username} />
          <meta
            name="keywords"
            content={hashtags.map(({ name }) => name).join(", ")}
          />
          <meta
            name="description"
            content={
              feed.content.length > 200
                ? feed.content.substring(0, 200)
                : feed.content
            }
          />
        </Helmet>
      )}

      <div className="w-full flex flex-row justify-center ani-show">
        {error && (
          <div className="flex flex-col wauto rounded-2xl bg-w m-2 p-6 items-center justify-center space-y-2">
            <h1 className="text-xl font-bold t-primary">{error}</h1>
            {error === "Not found" && id === "about" && (
              <Tips value={t("about.notfound")} />
            )}
            <Button
              title={t("index.back")}
              onClick={() => (window.location.href = "/")}
            />
          </div>
        )}

        {feed && !error && (
          <>
            <div className="xl:w-64" />

            <main className="wauto">
              <article
                className="rounded-2xl bg-w m-2 px-6 py-4"
                aria-label={feed.title ?? "Unnamed"}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="mt-1 mb-1 flex gap-1">
                      <p
                        className="text-gray-400 text-[12px]"
                        title={new Date(feed.createdAt).toLocaleString()}
                      >
                        {t("feed_card.published$time", {
                          time: timeago(feed.createdAt),
                        })}
                      </p>

                      {feed.createdAt !== feed.updatedAt && (
                        <p
                          className="text-gray-400 text-[12px]"
                          title={new Date(feed.updatedAt).toLocaleString()}
                        >
                          {t("feed_card.updated$time", {
                            time: timeago(feed.updatedAt),
                          })}
                        </p>
                      )}
                    </div>

                    {counterEnabled && (
                      <p className="text-[12px] text-gray-400 font-normal link-line">
                        <span> {t("count.pv")} </span>
                        <span>{feed.pv}</span>
                        <span> |</span>
                        <span> {t("count.uv")} </span>
                        <span>{feed.uv}</span>
                      </p>
                    )}

                    <div className="flex flex-row items-center">
                      <h1 className="text-2xl font-bold t-primary break-all">
                        {feed.title}
                      </h1>
                      <div className="flex-1 w-0" />
                    </div>
                  </div>

                  <div className="pt-2">
                    {profile?.permission && (
                      <div className="flex gap-2">
                        <button
                          aria-label={
                            top > 0 ? t("untop.title") : t("top.title")
                          }
                          onClick={topFeed}
                          className={`flex-1 flex flex-col items-end justify-center px-2 py rounded-full transition ${
                            top > 0
                              ? "bg-theme text-white hover:bg-theme-hover active:bg-theme-active"
                              : "bg-secondary bg-button dark:text-neutral-400"
                          }`}
                        >
                          <i className="ri-skip-up-line" />
                        </button>

                        <Link
                          aria-label={t("edit")}
                          href={`/admin/writing/${feed.id}`}
                          className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                        >
                          <i className="ri-edit-2-line dark:text-neutral-400" />
                        </Link>

                        <button
                          aria-label={t("delete.title")}
                          onClick={deleteFeed}
                          className="flex-1 flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                        >
                          <i className="ri-delete-bin-7-line text-red-500" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {(hasAISummary || showAISummaryState) && (
                  <div className="my-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/30">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <i className="ri-sparkling-2-fill text-purple-500" />
                        <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                          {t("ai_summary.title")}
                        </span>
                      </div>

                      {showAISummaryState ? (
                        <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-white/10 dark:text-purple-300">
                          {t(`ai_summary.status.${feed.ai_summary_status}`)}
                        </span>
                      ) : null}
                    </div>

                    <p className="whitespace-pre-wrap text-sm leading-relaxed t-secondary [overflow-wrap:anywhere]">
                      {hasAISummary
                        ? feed.ai_summary
                        : t(`ai_summary.message.${feed.ai_summary_status}`)}
                    </p>

                    {feed.ai_summary_status === "failed" &&
                    feed.ai_summary_error ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs text-rose-600 dark:text-rose-300 [overflow-wrap:anywhere]">
                        {feed.ai_summary_error}
                      </p>
                    ) : null}
                  </div>
                )}

                <Markdown content={feed.content} />

                <div className="mt-6 flex flex-col gap-2">
                  {hashtags.length > 0 && (
                    <div className="flex flex-row flex-wrap gap-x-2">
                      {hashtags.map(({ name }, index) => (
                        <HashTag key={index} name={name} />
                      ))}
                    </div>
                  )}

                  <div className="flex min-w-0 flex-row items-center">
                    <ImageWithFallback
                      src={feed.user.avatar || "/avatar.png"}
                      alt={feed.user.username}
                      className="h-8 w-8 rounded-full"
                    />
                    <div className="ml-2 min-w-0">
                      <span className="block truncate text-sm text-gray-400 cursor-default">
                        {feed.user.username}
                      </span>
                    </div>
                  </div>
                </div>
              </article>

              {id !== "about" && (
                <AdjacentSection id={id} setError={setError} />
              )}

              {feed && <Comments id={`${feed.id}`} />}

              <div className="h-16" />
            </main>

            <div className="w-80 hidden lg:block relative">
              <div className="start-0 end-0 top-[5.5rem] sticky">
                <TOC />
              </div>
            </div>
          </>
        )}
      </div>

      <AlertUI />
      <ConfirmUI />
    </Waiting>
  );
}

export function TOCHeader({ TOC }: { TOC: () => JSX.Element }) {
  const [isOpened, setIsOpened] = useState(false);

  return (
    <div className="shrink-0 lg:hidden">
      <button
        onClick={() => setIsOpened(true)}
        className="w-10 h-10 rounded-full flex flex-row items-center justify-center"
      >
        <i className="ri-menu-2-line text-neutral-500 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 ri-lg md:ri-sm md:t-secondary"></i>
      </button>

      <Modal
        isOpen={isOpened}
        onRequestClose={() => setIsOpened(false)}
        contentLabel="Table of contents"
        size="lg"
        panelClassName="p-4"
      >
        <div className="relative max-h-[75vh] overflow-auto t-primary">
          <TOC />
        </div>
      </Modal>
    </div>
  );
}

function CommentInput({
  id,
  onRefresh,
}: {
  id: string;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [content, setContent] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [isOpened, setIsOpened] = useState(false);
  const [showEmailHelp, setShowEmailHelp] = useState(false);

  const { showAlert, AlertUI } = useAlert();
  const profile = useContext(ProfileContext);
  const [, setLocation] = useLocation();
  const config = useContext(ClientConfigContext);

  const rawGuest = config.get("comment.guest.enabled");
  const guestEnabled = rawGuest !== false && rawGuest !== "false";

  const isAdmin = Boolean(profile?.permission);
  const requiresCaptcha = !isAdmin && (Boolean(profile) || guestEnabled);

  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetIdRef = useRef<string | null>(null);

  function closeModal() {
    if (submitting) return;

    setIsOpened(false);
    setShowEmailHelp(false);
    setTurnstileToken("");
    setError("");
    setAgreed(false);
  }

  useEffect(() => {
    if (!isOpened || !requiresCaptcha) return;

    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const renderCaptcha = () => {
      if (
        disposed ||
        !captchaContainerRef.current ||
        !window.turnstile
      ) {
        return false;
      }

      if (captchaWidgetIdRef.current) return true;

      try {
        captchaWidgetIdRef.current = window.turnstile.render(
          captchaContainerRef.current,
          {
            sitekey: TURNSTILE_SITE_KEY,
            action: "comment",

            callback: (token) => {
              setTurnstileToken(token);
              setError("");
            },

            "expired-callback": () => {
              setTurnstileToken("");
              setError("人机验证已过期，请重新验证");
            },

            "error-callback": () => {
              setTurnstileToken("");
              setError("人机验证加载失败，请刷新页面后重试");
            },
          }
        );

        return true;
      } catch {
        setError("人机验证加载失败，请刷新页面后重试");
        return false;
      }
    };

    const existingScript = document.querySelector(
      'script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]'
    ) as HTMLScriptElement | null;

    if (!existingScript) {
      const script = document.createElement("script");

      script.src = TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        renderCaptcha();
      };

      script.onerror = () => {
        if (!disposed) {
          setError("人机验证脚本加载失败，请刷新页面后重试");
        }
      };

      document.head.appendChild(script);
    }

    intervalId = setInterval(() => {
      if (renderCaptcha() && intervalId) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    }, 300);

    renderCaptcha();

    return () => {
      disposed = true;

      if (intervalId) {
        clearInterval(intervalId);
      }

      if (captchaWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(captchaWidgetIdRef.current);
        captchaWidgetIdRef.current = null;
      }
    };
  }, [isOpened, requiresCaptcha]);

  function resetCaptcha() {
    setTurnstileToken("");

    if (captchaWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(captchaWidgetIdRef.current);
    }
  }

  function errorHumanize(errorMessage: string) {
    if (errorMessage === "Unauthorized") {
      return t("login.required");
    }

    if (errorMessage === "Content is required") {
      return t("comment.empty");
    }

    if (errorMessage === "Guest name is required") {
      return t("comment.guest_name_required");
    }

    if (
      errorMessage === "Invalid Turnstile token" ||
      errorMessage === "Turnstile verification failed"
    ) {
      return "人机验证失败，请重新验证";
    }

    return errorMessage;
  }

  async function submit() {
    if (submitting) return;

    if (
      getCharacterLength(content) > MAX_COMMENT_LENGTH ||
      getCharacterLength(guestName) > MAX_COMMENT_LENGTH ||
      getCharacterLength(guestEmail) > MAX_COMMENT_LENGTH
    ) {
      setError("昵称、邮箱和评论内容均不能超过 200 个字符");
      return;
    }

    if (!agreed) {
      setError("请先阅读并同意评论发表协议");
      return;
    }

    if (requiresCaptcha && !turnstileToken) {
      setError("请先完成人机验证");
      return;
    }

    if (!profile && guestEnabled && !guestName.trim()) {
      setError(t("comment.guest_name_required"));
      return;
    }

    if (!profile && !guestEnabled) {
      setLocation("/login");
      return;
    }

    if (!content.trim()) {
      setError(t("comment.empty"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const requestData = profile
        ? {
            content,
            ...(requiresCaptcha ? { turnstileToken } : {}),
          }
        : {
            content,
            guestName: guestName.trim(),
            guestEmail: guestEmail.trim() || undefined,
            turnstileToken,
          };

      const result = await client.comment.create(
        parseInt(id),
        requestData
      );

      if (result.error) {
        setError(errorHumanize(result.error.value as string));
        setAgreed(false);
        resetCaptcha();
        return;
      }

      setContent("");
      setError("");
      setAgreed(false);

      if (!profile) {
        setGuestName("");
        setGuestEmail("");
      }

      resetCaptcha();
      setIsOpened(false);
      setShowEmailHelp(false);

      const successMessage = isAdmin
        ? "评论发布成功"
        : "评论已提交，等待管理员审核";

      showAlert(successMessage, () => {
        onRefresh();
      });
    } catch {
      setError("评论提交失败，请稍后重试");
      setAgreed(false);
      resetCaptcha();
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    !submitting &&
    agreed &&
    Boolean(content.trim()) &&
    getCharacterLength(content) <= MAX_COMMENT_LENGTH &&
    getCharacterLength(guestName) <= MAX_COMMENT_LENGTH &&
    getCharacterLength(guestEmail) <= MAX_COMMENT_LENGTH &&
    (Boolean(profile) || guestEnabled) &&
    (Boolean(profile) || !guestEnabled || Boolean(guestName.trim())) &&
    (!requiresCaptcha || Boolean(turnstileToken));

  const counterClass = (value: string) =>
    `mt-1 text-right text-xs ${
      getCharacterLength(value) >= MAX_COMMENT_LENGTH
        ? "text-red-500"
        : "text-neutral-400"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setIsOpened(true);
        }}
        className="shrink-0 rounded-full bg-theme px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 sm:px-5 sm:py-2.5 sm:text-base"
      >
        写下你的留言
      </button>

      <Modal
        isOpen={isOpened}
        onRequestClose={closeModal}
        contentLabel="写下你的留言"
        size="lg"
        panelClassName="rounded-2xl bg-w p-6 t-primary shadow-xl"
      >
        <div className="max-h-[80vh] overflow-y-auto">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold t-primary">
              写下你的留言
            </h2>

            <button
              type="button"
              onClick={closeModal}
              aria-label="关闭"
              disabled={submitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full t-secondary transition-colors hover:bg-secondary hover:t-primary disabled:opacity-50"
            >
              <i className="ri-close-line text-xl" />
            </button>
          </div>

          {!profile && guestEnabled && (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <input
                  type="text"
                  aria-label="昵称"
                  placeholder={t("comment.guest_name_placeholder")}
                  className="w-full min-w-0 rounded-lg border border-black/10 bg-secondary px-3 py-3 t-primary outline-none placeholder:text-neutral-400 focus:border-theme dark:border-white/10"
                  value={guestName}
                  onChange={(e) =>
                    setGuestName(limitCharacters(e.target.value))
                  }
                />
                <p className={counterClass(guestName)}>
                  {getCharacterLength(guestName)}/{MAX_COMMENT_LENGTH}
                </p>
              </div>

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="email"
                    aria-label="邮箱"
                    placeholder={t("comment.guest_email_placeholder")}
                    className="min-w-0 flex-1 rounded-lg border border-black/10 bg-secondary px-3 py-3 t-primary outline-none placeholder:text-neutral-400 focus:border-theme dark:border-white/10"
                    value={guestEmail}
                    onChange={(e) =>
                      setGuestEmail(limitCharacters(e.target.value))
                    }
                  />

                  <button
                    type="button"
                    aria-label="邮箱用途说明"
                    aria-expanded={showEmailHelp}
                    onClick={() =>
                      setShowEmailHelp((value) => !value)
                    }
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 text-sm font-semibold t-secondary transition-colors hover:bg-secondary dark:border-white/10"
                  >
                    ?
                  </button>
                </div>
                <p className={counterClass(guestEmail)}>
                  {getCharacterLength(guestEmail)}/{MAX_COMMENT_LENGTH}
                </p>
              </div>

              {showEmailHelp && (
                <p className="rounded-lg bg-secondary p-3 text-sm leading-6 t-secondary sm:col-span-2">
                  填写邮箱后，当你的留言审核状态发生变化时，可以通过邮件接收通知。邮箱仅用于通知，并以加密形式保存，不会公开展示给其他人。
                </p>
              )}
            </div>
          )}

          {!profile && !guestEnabled && (
            <div className="flex w-full flex-col items-center justify-center py-8">
              <p className="mb-4 text-sm t-secondary">
                {t("login.required")}
              </p>

              <button
                type="button"
                className="rounded-full bg-theme px-5 py-2.5 text-white transition hover:bg-theme-hover"
                onClick={() => setLocation("/login")}
              >
                {t("login.required")}
              </button>
            </div>
          )}

          {(profile || guestEnabled) && (
            <>
              <textarea
                id="comment"
                placeholder={t("comment.placeholder.title")}
                className="min-h-32 w-full rounded-lg border border-black/10 bg-secondary p-3 t-primary outline-none placeholder:text-neutral-400 focus:border-theme dark:border-white/10"
                value={content}
                onChange={(e) =>
                  setContent(limitCharacters(e.target.value))
                }
              />
              <p className={counterClass(content)}>
                {getCharacterLength(content)}/{MAX_COMMENT_LENGTH}
              </p>

              {requiresCaptcha && (
                <div className="mt-4 w-full">
                  <div ref={captchaContainerRef} />
                </div>
              )}

              <label className="mt-4 flex w-full items-center gap-2 text-sm t-secondary">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="h-4 w-4 accent-current"
                />

                <span>
                  发表评论表示你同意
                  <a
                    href="https://blog.otaoi.top/feed/1"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-theme underline"
                  >
                    《评论发表协议》
                  </a>
                </span>
              </label>

              {error && (
                <p className="mt-3 text-sm text-red-500" role="alert">
                  {error}
                </p>
              )}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  className={`rounded-full px-6 py-3 font-medium transition-colors ${
                    canSubmit
                      ? "bg-theme text-white hover:bg-theme-hover"
                      : "cursor-not-allowed bg-secondary t-secondary opacity-60"
                  }`}
                  onClick={submit}
                  disabled={!canSubmit}
                >
                  {submitting ? "提交中..." : t("comment.submit")}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <AlertUI />
    </>
  );
}

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: number;
    username: string;
    avatar: string | null;
    permission: number | null;
  } | null;
  guestName?: string;
  guestEmail?: string;
  guestWebsite?: string;
};

function Comments({ id }: { id: string }) {
  const config = useContext(ClientConfigContext);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string>();
  const ref = useRef("");
  const { t } = useTranslation();

  function loadComments() {
    client.comment.list(parseInt(id)).then(({ data, error }) => {
      if (error) {
        setError(error.value as string);
      } else if (data && Array.isArray(data)) {
        setComments(data as any);
        setError(undefined);
      }
    });
  }

  useEffect(() => {
    if (ref.current == id) return;

    loadComments();
    ref.current = id;
  }, [id]);

  return (
    <>
      {config.getBoolean("comment.enabled") && (
        <div className="m-2 flex min-w-0 flex-col">
          <div className="flex w-full min-w-0 items-center justify-between gap-2 rounded-2xl bg-w p-4 sm:gap-3 sm:p-5">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="shrink-0 text-lg font-bold t-primary">
                评论
              </h2>

              <span className="truncate text-sm text-gray-400">
                共 {comments.length} 条评论
              </span>
            </div>

            <CommentInput id={id} onRefresh={loadComments} />
          </div>

          {error && (
            <div className="flex flex-col wauto rounded-2xl bg-w t-primary m-2 p-6 items-center justify-center">
              <h1 className="text-xl font-bold t-primary">
                {error}
              </h1>

              <button
                className="mt-2 bg-theme text-white px-4 py-2 rounded-full"
                onClick={loadComments}
              >
                {t("reload")}
              </button>
            </div>
          )}

          {comments.length > 0 && (
            <div className="w-full">
              {comments.map((comment) => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  onRefresh={loadComments}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function CommentItem({
  comment,
  onRefresh,
}: {
  comment: Comment;
  onRefresh: () => void;
}) {
  const { showConfirm, ConfirmUI } = useConfirm();
  const { showAlert, AlertUI } = useAlert();
  const { t } = useTranslation();
  const profile = useContext(ProfileContext);

  const isAdmin = Boolean(profile?.permission);

  const commenterName =
    comment.user?.username ||
    comment.guestName ||
    t("anonymous");

  function deleteComment() {
    showConfirm(
      t("delete.comment.title"),
      t("delete.comment.confirm"),
      async () => {
        client.comment.delete(comment.id).then(({ error }) => {
          if (error) {
            showAlert(error.value as string);
          } else {
            showAlert(t("delete.success"), () => {
              onRefresh();
            });
          }
        });
      }
    );
  }

  return (
    <div className="flex flex-row items-start rounded-xl mt-2">
      <div className="flex flex-col flex-1 w-0 bg-w rounded-xl p-4">
        <div className="flex min-w-0 flex-row items-center gap-2">
          <span className="min-w-0 truncate text-base font-bold t-primary">
            {commenterName}
          </span>

          {isAdmin && !comment.user && comment.guestEmail && (
            <span className="min-w-0 break-all text-xs text-gray-400">
              游客邮箱：{comment.guestEmail}
            </span>
          )}

          {comment.guestWebsite && (
            <a
              href={comment.guestWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-gray-400 transition-colors hover:text-theme"
            >
              <i className="ri-external-link-line"></i>
            </a>
          )}

          <div className="flex-1 w-0" />

          <span
            title={new Date(comment.createdAt).toLocaleString()}
            className="shrink-0 text-sm text-gray-400"
          >
            {timeago(comment.createdAt)}
          </span>
        </div>

        <p className="break-words t-primary [overflow-wrap:anywhere]">
          {comment.content}
        </p>

        <div className="flex flex-row justify-end">
          {(profile?.permission ||
            (comment.user && profile?.id == comment.user.id)) && (
            <Popup
              arrow={false}
              trigger={
                <button className="px-2 py bg-secondary rounded-full">
                  <i className="ri-more-fill t-secondary"></i>
                </button>
              }
              position="left center"
            >
              <div className="flex flex-row self-end mr-2">
                <button
                  onClick={deleteComment}
                  aria-label={t("delete.comment.title")}
                  className="px-2 py bg-secondary rounded-full"
                >
                  <i className="ri-delete-bin-2-line t-secondary"></i>
                </button>
              </div>
            </Popup>
          )}
        </div>
      </div>

      <ConfirmUI />
      <AlertUI />
    </div>
  );
}
