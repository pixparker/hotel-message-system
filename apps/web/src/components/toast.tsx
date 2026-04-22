import * as ToastPrimitive from "@radix-ui/react-toast";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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
  open: boolean;
}

// Must match the toast-out keyframe duration in styles.css so the
// element stays mounted long enough for the exit animation to play.
const EXIT_ANIMATION_MS = 220;
const AUTO_DISMISS_MS = 5000;

const Ctx = createContext<{ push: (t: Omit<ToastItem, "id" | "open">) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const close = useCallback((id: number) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, open: false } : p)));
    setTimeout(() => {
      setItems((prev) => prev.filter((p) => p.id !== id));
    }, EXIT_ANIMATION_MS);
  }, []);

  return (
    <Ctx.Provider
      value={{
        push: (t) =>
          setItems((prev) => [
            ...prev,
            { ...t, id: Date.now() + Math.random(), open: true },
          ]),
      }}
    >
      <ToastPrimitive.Provider swipeDirection="right" duration={Infinity}>
        {children}
        {items.map((item) => (
          <ToastRow key={item.id} item={item} onClose={close} />
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2" />
      </ToastPrimitive.Provider>
    </Ctx.Provider>
  );
}

function ToastRow({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: (id: number) => void;
}) {
  // Self-managed auto-dismiss. Radix's own timer is disabled (Provider
  // duration={Infinity}) because it pauses on hover / window-blur — useful
  // for a11y but it can leave toasts pinned on-screen during development.
  // A plain setTimeout gives us predictable 5s dismissal.
  useEffect(() => {
    if (!item.open) return;
    const t = setTimeout(() => onClose(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [item.id, item.open, onClose]);

  return (
    <ToastPrimitive.Root
      open={item.open}
      onOpenChange={(open) => {
        if (!open) onClose(item.id);
      }}
      className="hms-toast card flex items-start gap-3 p-4"
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
          onClick={() => item.action!.onClick()}
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
  );
}
