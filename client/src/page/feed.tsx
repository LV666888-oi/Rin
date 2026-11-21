import type { Feed } from “@rin/api”;
import { Modal } from “@rin/ui”;
import { useContext, useEffect, useRef, useState } from “react”;
import { Helmet } from “react-helmet”;
import { useTranslation } from “react-i18next”;
import Popup from “reactjs-popup”;
import { Link, useLocation } from “wouter”;
import { useAlert, useConfirm } from “../components/dialog”;
import { HashTag } from “../components/hashtag”;
import { ImageWithFallback } from “../components/image-with-fallback”;
import { Waiting } from “../components/loading”;
import { Markdown } from “../components/markdown”;
import { client } from “../app/runtime”;
import { ClientConfigContext } from “../state/config”;
import { ProfileContext } from “../state/profile”;
import { useSiteConfig } from “../hooks/useSiteConfig”;
import { siteName } from “../utils/constants”;
import { timeago } from “../utils/timeago”;
import { Button } from “../components/button”;
import { Tips } from “../components/tips”;
import mermaid from “mermaid”;
import { AdjacentSection } from “../components/adjacent_feed.tsx”;
import { stripImageUrlMetadata } from “../utils/image-upload”;

declare global {
interface Window {
turnstile?: {
render: (
container: HTMLElement,
options: {
sitekey: string;
action: string;
callback: (token: string) => void;
“expired-callback”: () => void;
“error-callback”: () => void;
}
) => string;
remove: (widgetId: string) => void;
reset: (widgetId: string) => void;
};
}
}

const TURNSTILE_SITE_KEY = “0x4AAAAAAGKowduOW9jDZSdd”;
const TURNSTILE_SCRIPT_URL =
“https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit”;

function extractFirstMarkdownImageUrl(content: string) {
const match = /![.?]((\S+?)(?:\s+”[^”]”)?)/.exec(content);
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
const [feed, setFeed] = useState();
const [error, setError] = useState();
const [headImage, setHeadImage] = useState();
const ref = useRef(””);
const [, setLocation] = useLocation();
const { showAlert, AlertUI } = useAlert();
const { showConfirm, ConfirmUI } = useConfirm();
const [top, setTop] = useState(0);
const config = useContext(ClientConfigContext);
const counterEnabled = config.getBoolean(“counter.enabled”);
const hasAISummary = Boolean(feed?.ai_summary?.trim());
const showAISummaryState =
feed?.ai_summary_status === “pending” ||
feed?.ai_summary_status === “processing” ||
feed?.ai_summary_status === “failed”;
const hashtags = Array.isArray(feed?.hashtags) ? feed.hashtags : [];

function deleteFeed() {
showConfirm(
t(“article.delete.title”),
t(“article.delete.confirm”),
() => {
if (!feed) return;
client.feed.delete(feed.id).then(({ error }) => {
if (error) {
showAlert(error.value as string);
} else {
showAlert(t(“delete.success”));
setLocation(”/”);
}
});
}
);
}

function topFeed() {
const isUnTop = !(top > 0);
const topNew = isUnTop ? 1 : 0;
showConfirm(
isUnTop ? t(“article.top.title”) : t(“article.untop.title”),
isUnTop ? t(“article.top.confirm”) : t(“article.untop.confirm”),
() => {
if (!feed) return;
client.feed.setTop(feed.id, topNew).then(({ error }) => {
if (error) {
showAlert(error.value as string);
} else {
showAlert(
isUnTop
? t(“article.top.success”)
: t(“article.untop.success”)
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
} else if (data && typeof data !== “string”) {
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
theme: “default”,
});
mermaid
.run({
suppressErrors: true,
nodes: document.querySelectorAll(“pre.mermaid_default”),
})
.then(() => {
mermaid.initialize({
startOnLoad: false,
theme: “dark”,
});
mermaid.run({
suppressErrors: true,
nodes: document.querySelectorAll(“pre.mermaid_dark”),
});
});
}, [feed]);

return (
<Waiting for={feed || error}>
{feed && (
{${feed.title ?? "Unnamed"} - ${siteConfig.name}}
<meta property=“og:title” content={feed.title ?? “”} />
<meta property=“og:image” content={headImage ?? siteConfig.avatar} />
 200
? feed.content.substring(0, 200)
: feed.content
}
/>
<meta
name=“keywords”
content={hashtags.map(({ name }) => name).join(”, “)}
/>
 200
? feed.content.substring(0, 200)
: feed.content
}
/>
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
                      aria-label={top > 0 ? t("untop.title") : t("top.title")}
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
<button
onClick={() => setIsOpened(true)}
className=“w-10 h-10 rounded-full flex flex-row items-center justify-center”
>
<Modal
isOpen={isOpened}
onRequestClose={() => setIsOpened(false)}
contentLabel=“Table of contents”
size=“lg”
panelClassName=“p-4”
>
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
const [isOpened, setIsOpened] = useState(false);
const [showEmailHelp, setShowEmailHelp] = useState(false);
const [content, setContent] = useState(””);
const [guestName, setGuestName] = useState(””);
const [guestEmail, setGuestEmail] = useState(””);
const [error, setError] = useState(””);
const [turnstileToken, setTurnstileToken] = useState(””);
const [submitting, setSubmitting] = useState(false);
const [agreed, setAgreed] = useState(false);
const { showAlert, AlertUI } = useAlert();
const profile = useContext(ProfileContext);
const [, setLocation] = useLocation();
const config = useContext(ClientConfigContext);

const rawGuest = config.get(“comment.guest.enabled”);
const guestEnabled = rawGuest !== false && rawGuest !== “false”;
const isAdmin = Boolean(profile?.permission);
const requiresCaptcha = !isAdmin && (Boolean(profile) || guestEnabled);

const captchaContainerRef = useRef(null);
const captchaWidgetIdRef = useRef<string | null>(null);

useEffect(() => {
if (!requiresCaptcha || !isOpened) {
return;
}

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
  if (captchaWidgetIdRef.current) {
    return true;
  }
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

}, [requiresCaptcha, isOpened]);

function resetCaptcha() {
setTurnstileToken(””);

if (captchaWidgetIdRef.current && window.turnstile) {
  window.turnstile.reset(captchaWidgetIdRef.current);
}

}

function closeModal() {
setIsOpened(false);
setShowEmailHelp(false);
}

function errorHumanize(error: string) {
if (error === “Unauthorized”) return t(“login.required”);
if (error === “Content is required”) return t(“comment.empty”);
if (error === “Guest name is required”) {
return t(“comment.guest_name_required”);
}
if (error === “Invalid Turnstile token”) {
return “人机验证失败，请重新验证”;
}
if (error === “Turnstile verification failed”) {
return “人机验证失败，请重新验证”;
}
return error;
}

async function submit() {
if (submitting) {
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
if (profile && !content.trim()) {
  setError(t("comment.empty"));
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
  closeModal();
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
(!requiresCaptcha || Boolean(turnstileToken));

const agreementCheckbox = (
<input
type=“checkbox”
checked={agreed}
onChange={(e) => setAgreed(e.target.checked)}
className=“h-5 w-5 shrink-0 accent-current”
/>
发表评论表示你同意
《评论发表协议》
);

return (
<>
<button
type=“button”
onClick={() => setIsOpened(true)}
className=“rounded-full bg-black px-8 py-3 text-white transition hover:bg-gray-800 active:bg-gray-900 dark:bg-white dark:text-black dark:hover:bg-gray-200”
>
评论
  <Modal
    isOpen={isOpened}
    onRequestClose={closeModal}
    contentLabel="写下你的留言"
    size="lg"
    panelClassName="!max-w-4xl !w-[calc(100%-24px)] !rounded-3xl !bg-white !p-0 dark:!bg-neutral-900"
  >
    <div className="max-h-[85vh] overflow-y-auto rounded-3xl bg-white text-gray-900 dark:bg-neutral-900 dark:text-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5 dark:border-neutral-700 sm:px-10">
        <h2 className="text-2xl font-bold">
          写下你的留言
        </h2>
        <button
          type="button"
          onClick={closeModal}
          aria-label="关闭"
          className="flex h-10 w-10 items-center justify-center rounded-full text-3xl text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-neutral-800"
        >
          ×
        </button>
      </div>
      <div className="p-6 sm:p-10">
        {!profile && guestEnabled ? (
          <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-2 block text-lg font-medium">
                昵称
              </label>
              <input
                type="text"
                placeholder="怎么称呼你"
                className="h-16 w-full rounded-2xl border border-gray-300 bg-white px-5 text-base outline-none transition focus:border-gray-500 dark:border-neutral-600 dark:bg-neutral-800"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <label className="text-lg font-medium">
                  邮箱
                </label>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  (仅用于通知审核状态不会公开给他人)
                </span>
                <button
                  type="button"
                  aria-label="邮箱用途说明"
                  aria-expanded={showEmailHelp}
                  onClick={() => setShowEmailHelp((value) => !value)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-400 text-sm font-semibold text-gray-500 transition hover:border-gray-700 hover:text-gray-900 dark:border-neutral-500 dark:text-gray-300"
                >
                  ?
                </button>
              </div>
              {showEmailHelp && (
                <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed text-gray-600 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-gray-300">
                  填写邮箱后，当你的留言审核状态发生变化时，可以通过邮件接收通知。邮箱仅用于通知，并以加密形式保存，不会公开展示给其他人。
                </div>
              )}
              <input
                type="email"
                placeholder="用于接收留言通知"
                className="h-16 w-full rounded-2xl border border-gray-300 bg-white px-5 text-base outline-none transition focus:border-gray-500 dark:border-neutral-600 dark:bg-neutral-800"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
          </div>
        ) : null}
        {!profile && !guestEnabled ? (
          <div className="flex w-full flex-col items-center justify-center py-12">
            <p className="mb-4 text-gray-500">
              请登录后再发表评论
            </p>
            <button
              type="button"
              className="rounded-full bg-black px-8 py-3 text-white dark:bg-white dark:text-black"
              onClick={() => setLocation("/login")}
            >
              {t("login.required")}
            </button>
          </div>
        ) : (
          <>
            <label
              htmlFor="comment"
              className="mb-2 block text-lg font-medium"
            >
              评论
            </label>
            <textarea
              id="comment"
              placeholder="关于这篇文章，你想说些什么？"
              className="min-h-48 w-full resize-y rounded-2xl border border-gray-300 bg-white p-5 text-base outline-none transition focus:border-gray-500 dark:border-neutral-600 dark:bg-neutral-800"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {requiresCaptcha && (
              <div className="mt-5 w-full overflow-hidden">
                <div ref={captchaContainerRef} />
              </div>
            )}
            {agreementCheckbox}
            {error && (
              <p className="mt-4 text-sm text-red-500">
                {error}
              </p>
            )}
            <button
              type="button"
              className="mt-8 min-w-56 rounded-full bg-black px-10 py-4 text-lg font-medium text-white transition hover:bg-gray-800 active:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-gray-200"
              onClick={submit}
              disabled={!canSubmit}
            >
              {submitting ? "提交中..." : "提交留言"}
            </button>
          </>
        )}
      </div>
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
const [error, setError] = useState();
const ref = useRef(””);
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
{config.getBoolean(“comment.enabled”) && (
评论
{comments.length} 条留言
      {error && (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-w t-primary m-2 p-6">
          <h1 className="text-xl font-bold t-primary">{error}</h1>
          <button
            className="mt-2 rounded-full bg-theme px-4 py-2 text-white"
            onClick={loadComments}
          >
            {t("reload")}
          </button>
        </div>
      )}
      {comments.length > 0 ? (
        <div className="mt-4 w-full">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onRefresh={loadComments}
            />
          ))}
        </div>
      ) : (
        <p className="px-2 py-8 text-sm text-gray-500 dark:text-gray-400">
          还没有留言，欢迎分享你的想法。
        </p>
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
const commenterName =
comment.user?.username || comment.guestName || t(“anonymous”);

function deleteComment() {
showConfirm(
t(“delete.comment.title”),
t(“delete.comment.confirm”),
async () => {
client.comment.delete(comment.id).then(({ error }) => {
if (error) {
showAlert(error.value as string);
} else {
showAlert(t(“delete.success”), () => {
onRefresh();
});
}
});
}
);
}

return (
{commenterName}
      {comment.guestWebsite && (
        <a
          href={comment.guestWebsite}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-gray-400 transition-colors hover:text-theme"
        >
          <i className="ri-external-link-line" />
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
            <button className="rounded-full bg-secondary px-2 py">
              <i className="ri-more-fill t-secondary" />
            </button>
          }
          position="left center"
        >
          <div className="mr-2 flex flex-row self-end">
            <button
              onClick={deleteComment}
              aria-label={t("delete.comment.title")}
              className="rounded-full bg-secondary px-2 py"
            >
              <i className="ri-delete-bin-2-line t-secondary" />
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
