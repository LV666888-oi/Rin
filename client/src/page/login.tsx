import { t } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ButtonWithLoading } from "../components/button";
import { Icon } from "../components/icon";
import { Input } from "../components/input";
import { client, oauth_url } from "../app/runtime";
import { setAuthToken } from "../utils/auth";
import { getLoginRedirectPath } from "../utils/auth-redirect";
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
        };
    }
}
const TURNSTILE_SITE_KEY = "0x4AAAAAAGKowduOW9jDZSdd";
export function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [turnstileToken, setTurnstileToken] = useState("");
    const [authStatus, setAuthStatus] = useState<{
        github: boolean;
        password: boolean;
    }>({ github: false, password: false });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [, setLocation] = useLocation();
    const turnstileRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    // Fetch auth status on mount
    useEffect(() => {
        client.auth.status().then(({ data }) => {
            if (data) {
                setAuthStatus(data);
            }
        });
    }, []);
    // Load and render Cloudflare Turnstile
useEffect(() => {
    let cancelled = false;
    let widgetRendered = false;
    let checkTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let script: HTMLScriptElement | null = null;
    const renderWidget = () => {
        if (
            cancelled ||
            widgetRendered ||
            !turnstileRef.current ||
            !window.turnstile
        ) {
            return;
        }
        try {
            widgetIdRef.current = window.turnstile.render(
                turnstileRef.current,
                {
                    sitekey: TURNSTILE_SITE_KEY,
                    action: "login",
                    callback: (token) => {
                        setTurnstileToken(token);
                        setError("");
                    },
                    "expired-callback": () => {
                        setTurnstileToken("");
                    },
                    "error-callback": () => {
                        setTurnstileToken("");
                        setError("人机验证加载失败，请刷新页面重试");
                    },
                }
            );
            widgetRendered = true;
            if (checkTimer) {
                clearInterval(checkTimer);
                checkTimer = null;
            }
            if (timeoutTimer) {
                clearTimeout(timeoutTimer);
                timeoutTimer = null;
            }
        } catch (err) {
            setError("人机验证加载失败，请刷新页面重试");
        }
    };
    // 如果 Turnstile 已经加载，直接渲染
    if (window.turnstile) {
        renderWidget();
    } else {
        // 查找已经存在的 Cloudflare 脚本
        script = document.querySelector<HTMLScriptElement>(
            'script[src*="challenges.cloudflare.com/turnstile"]'
        );
        // 如果不存在，则创建并加载
        if (!script) {
            script = document.createElement("script");
            script.src =
                "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            document.head.appendChild(script);
        }
        // 持续检查脚本是否加载完成，避免错过 load 事件
        checkTimer = setInterval(() => {
            if (window.turnstile) {
                renderWidget();
            }
        }, 200);
        // 15 秒仍未加载则提示
        timeoutTimer = setTimeout(() => {
            if (!widgetRendered && !cancelled) {
                setError("人机验证加载超时，请检查网络后刷新页面");
            }
        }, 15000);
    }
    return () => {
        cancelled = true;
        if (checkTimer) {
            clearInterval(checkTimer);
        }
        if (timeoutTimer) {
            clearTimeout(timeoutTimer);
        }
        if (widgetIdRef.current && window.turnstile) {
            window.turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
        }
    };
}, []);
    const handleLogin = async () => {
        if (!username || !password) {
            setError(t("login.error.empty"));
            return;
        }
        if (!turnstileToken) {
            setError("请先完成人机验证");
            return;
        }
        setIsLoading(true);
        setError("");
        try {
            const { data, error: apiError } = await client.auth.login({
                username,
                password,
                turnstileToken,
            });
            if (apiError) {
                setError(t("login.error.invalid"));
                return;
            }
            if (data?.success) {
                // Save token to localStorage for cross-domain auth
                if (data.token) {
                    setAuthToken(data.token);
                }
                setLocation(getLoginRedirectPath(window.location.search));
                window.location.reload();
            } else {
                setError(t("login.error.failed"));
            }
        } catch (err) {
            setError(t("login.error.network"));
        } finally {
            setIsLoading(false);
        }
    };
    return (
        <div className="flex items-center justify-center my-8">
            <div className="bg-w w-full max-w-md flex flex-col items-center justify-between p-8 space-y-4 t-primary rounded-2xl shadow-lg">
                <p className="text-2xl font-bold">{t("login.title")}</p>
                {/* Error message */}
                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}
                {/* Password login form */}
                {authStatus.password && (
                    <>
                        <Input
                            value={username}
                            setValue={setUsername}
                            placeholder={t("login.username.placeholder")}
                            disabled={isLoading}
                            autofocus
                        />
                        <Input
                            value={password}
                            setValue={setPassword}
                            placeholder={t("login.password.placeholder")}
                            type="password"
                            onSubmit={handleLogin}
                            disabled={isLoading}
                        />
                        {/* Cloudflare Turnstile */}
                        <div className="flex justify-center pt-2">
                            <div ref={turnstileRef}></div>
                        </div>
                        <div className="flex flex-row items-center space-x-4 pt-2">
                            <ButtonWithLoading
                                title={
                                    isLoading
                                        ? t("login.loading")
                                        : t("login.title")
                                }
                                onClick={handleLogin}
                                loading={isLoading}
                            />
                        </div>
                    </>
                )}
                {/* OAuth options */}
                {authStatus.github && (
                    <div className="flex flex-col justify-center items-center space-y-2 pt-2">
                        {authStatus.password && (
                            <p className="text-xs t-secondary">
                                {t("login.or")}
                            </p>
                        )}
                        {!authStatus.password && (
                            <p className="text-xs t-secondary">
                                {t("login.oauth_only")}
                            </p>
                        )}
                        <div className="flex flex-row items-center space-x-4">
                            <Icon
                                label={t("github_login")}
                                name="ri-github-line"
                                onClick={() => {
                                    window.location.href = `${oauth_url}`;
                                }}
                                hover={true}
                            />
                        </div>
                    </div>
                )}
                {/* No auth methods available */}
                {!authStatus.github && !authStatus.password && (
                    <p className="text-sm text-red-500">
                        {t("login.no_methods")}
                    </p>
                )}
            </div>
        </div>
    );
}
