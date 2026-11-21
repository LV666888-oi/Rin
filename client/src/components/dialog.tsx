import { Modal } from "@rin/ui";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, ButtonWithLoading } from "./button";

export type Confirm = {
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
};

export type Alert = {
    message: string;
    onConfirm: () => Promise<void> | void;
};

export type ShowAlertType = (
    msg: string,
    onConfirm?: () => Promise<void> | void
) => void;

export function useAlert() {
    const [alert, setAlert] = useState<Alert | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const closingRef = useRef(false);
    const alertRef = useRef<Alert | null>(null);

    const close = useCallback(async () => {
        if (closingRef.current) return;

        closingRef.current = true;

        const currentAlert = alertRef.current;
        alertRef.current = null;

        setIsOpen(false);
        setAlert(null);

        try {
            await currentAlert?.onConfirm();
        } catch (error) {
            console.error("Alert callback failed:", error);
        } finally {
            closingRef.current = false;
        }
    }, []);

    const showAlert = useCallback<ShowAlertType>((message, onConfirm) => {
        closingRef.current = false;

        const nextAlert: Alert = {
            message,
            onConfirm: onConfirm ?? (() => {})
        };

        alertRef.current = nextAlert;
        setAlert(nextAlert);
        setIsOpen(true);
    }, []);

    const { t } = useTranslation();

    const AlertUI = () => (
        <Modal
            isOpen={isOpen}
            shouldCloseOnOverlayClick={true}
            shouldCloseOnEsc={true}
            onRequestClose={() => {
                void close();
            }}
            contentLabel={t("alert")}
            size="sm"
            panelClassName="p-6"
        >
            <div className="flex w-full flex-col items-start space-y-4">
                <h1 className="text-xl font-bold tracking-[-0.02em] t-primary">
                    {t("alert")}
                </h1>
                <p className="text-base t-primary">
                    {alert?.message}
                </p>
                <div className="w-full flex flex-row items-center justify-center space-x-2 mt-4">
                    <Button
                        onClick={() => {
                            void close();
                        }}
                        title={t("confirm")}
                    />
                </div>
            </div>
        </Modal>
    );

    return { showAlert, close, AlertUI };
}

export function useConfirm() {
    const [confirm, setConfirm] = useState<Confirm | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const close = () => {
        if (loading) return;

        setConfirm(null);
        setIsOpen(false);
    };

    const showConfirm = (
        title: string,
        message: string,
        onConfirm?: () => Promise<void> | void
    ) => {
        setConfirm({
            title,
            message,
            onConfirm: onConfirm ?? (() => {})
        });

        setIsOpen(true);
    };

    const { t } = useTranslation();

    const ConfirmUI = () => (
        <Modal
            isOpen={isOpen}
            shouldCloseOnOverlayClick={!loading}
            shouldCloseOnEsc={!loading}
            onRequestClose={close}
            contentLabel={confirm?.title ?? t("confirm")}
            size="sm"
            panelClassName="p-6"
        >
            <div className="flex w-full flex-col items-start space-y-4">
                <h1 className="text-xl font-bold tracking-[-0.02em] t-primary">
                    {confirm?.title}
                </h1>
                <p className="text-base t-primary">
                    {confirm?.message}
                </p>
                <div className="w-full flex flex-row items-center justify-center space-x-2 mt-4">
                    <ButtonWithLoading
                        loading={loading}
                        onClick={async () => {
                            if (loading) return;

                            setLoading(true);

                            try {
                                await confirm?.onConfirm();
                                setIsOpen(false);
                                setConfirm(null);
                            } catch (error) {
                                console.error("Confirm callback failed:", error);
                            } finally {
                                setLoading(false);
                            }
                        }}
                        title={t("confirm")}
                    />
                    <Button
                        secondary
                        onClick={close}
                        title={t("cancel")}
                    />
                </div>
            </div>
        </Modal>
    );

    return { showConfirm, close, ConfirmUI };
}
