import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X, Undo2 } from "lucide-react";

type Variant = "success" | "error";
interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: Variant;
  action?: ToastAction;
}

const Ctx = createContext<{ push: (t: Omit<ToastItem, "id">) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  return (
    <Ctx.Provider
      value={{
        push: (t) =>
          setItems((prev) => [...prev, { ...t, id: Date.now() + Math.random() }]),
      }}
    >
      <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((p) => p.id !== item.id));
            }}
            className="card flex items-start gap-3 p-4 data-[state=open]:animate-in data-[state=open]:fade-in"
          >
            {item.variant === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <ToastPrimitive.Title className="text-sm font-medium">
                {item.title}
              </ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="mt-1 text-sm text-slate-600">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            {item.action && (
              <ToastPrimitive.Action
                altText={item.action.label}
                asChild
                onClick={() => {
                  item.action!.onClick();
                  setItems((prev) => prev.filter((p) => p.id !== item.id));
                }}
              >
                <button className="btn-ghost !px-2 !py-1 text-brand-700 font-medium">
                  <Undo2 className="h-4 w-4" />
                  {item.action.label}
                </button>
              </ToastPrimitive.Action>
            )}
            <ToastPrimitive.Close className="text-slate-400 hover:text-slate-700 shrink-0">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" />
      </ToastPrimitive.Provider>
    </Ctx.Provider>
  );
}
