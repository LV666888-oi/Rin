import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";

export function NavBar({
  menu,
  onClick,
  itemClassName = "",
}: {
  menu: boolean;
  onClick?: () => void;
  itemClassName?: string;
}) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const [otherOpen, setOtherOpen] = useState(false);

  useEffect(() => {
    setOtherOpen(false);
  }, [location]);

  const otherSelected = location === "/open-source-license";

  return (
    <>
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("article.title")} selected={location === "/" || location.startsWith("/feed")} href="/" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("timeline")} selected={location === "/timeline"} href="/timeline" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("moments.title")} selected={location === "/moments"} href="/moments" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("hashtags")} selected={location === "/hashtags"} href="/hashtags" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("friends.title")} selected={location === "/friends"} href="/friends" />
      <NavItem menu={menu} onClick={onClick} itemClassName={itemClassName} title={t("about.title")} selected={location === "/about"} href="/about" />

      <div className={`relative ${menu ? "w-full" : "inline-flex"}`}>
        <button
          type="button"
          onClick={() => setOtherOpen((value) => !value)}
          aria-expanded={otherOpen}
          className={`${menu ? "w-full text-left" : ""} cursor-pointer px-2 py-4 md:p-4 text-sm duration-300 hover:text-theme ${
            otherSelected ? "text-theme" : "dark:text-white"
          } ${itemClassName}`}
        >
          其他
          <i className={`ri-arrow-down-s-line ml-1 transition-transform ${otherOpen ? "rotate-180" : ""}`} />
        </button>

        {otherOpen && (
          <div
            className={`z-50 rounded-xl border border-black/10 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-dark ${
              menu
                ? "relative ml-3 mt-1 w-[calc(100%-12px)]"
                : "absolute left-0 top-full min-w-52"
            }`}
          >
            <Link
              href="/open-source-license"
              state={{ animate: true }}
              onClick={() => {
                setOtherOpen(false);
                onClick?.();
              }}
              className={`block rounded-lg px-4 py-3 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                otherSelected ? "text-theme" : "text-neutral-700 dark:text-neutral-200"
              }`}
            >
              开源项目使用协议
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

function NavItem({
  menu,
  title,
  selected,
  href,
  when = true,
  onClick,
  itemClassName = "",
}: {
  title: string;
  selected: boolean;
  href: string;
  menu?: boolean;
  when?: boolean;
  onClick?: () => void;
  itemClassName?: string;
}) {
  return when ? (
    <Link
      href={href}
      className={`${menu ? "" : "hidden"} md:block cursor-pointer hover:text-theme duration-300 px-2 py-4 md:p-4 text-sm ${
        selected ? "text-theme" : "dark:text-white"
      } ${itemClassName}`}
      state={{ animate: true }}
      onClick={onClick}
    >
      {title}
    </Link>
  ) : null;
}
