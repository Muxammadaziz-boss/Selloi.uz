"use client";

import type React from "react";
import {
  api,
  type ConnectedChannel,
  type Conversation,
  type KnowledgePost,
  type OrderItem,
  type PendingConfirmState,
  type ProductItem,
} from "../lib/dashboardApi";

interface UseChatAndCatalogActionsParams {
  selected: number | null;
  draft: string;
  setDraft: (v: string) => void;
  setBusy: (v: boolean) => void;
  setSuccess: (msg: string) => void;
  setError: (msg: string) => void;
  load: () => Promise<void>;
  loadMessages: (id: number) => Promise<void>;
  products: ProductItem[];
  setProducts: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  editingProduct: ProductItem | null;
  setEditingProduct: (p: ProductItem | null) => void;
  newProduct: Partial<ProductItem>;
  setNewProduct: (p: Partial<ProductItem>) => void;
  setIsAddingProduct: (b: boolean) => void;
  setOrders: React.Dispatch<React.SetStateAction<OrderItem[]>>;
  setPosts: React.Dispatch<React.SetStateAction<KnowledgePost[]>>;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setCustomerNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  newChannelInput: string;
  setNewChannelInput: (v: string) => void;
  setPendingConfirm: (state: PendingConfirmState | null) => void;
}

/**
 * Encapsulates inbox messaging, customer notes, knowledge channels, products CRUD, and order actions.
 */
export function useChatAndCatalogActions({
  selected,
  draft,
  setDraft,
  setBusy,
  setSuccess,
  setError,
  load,
  loadMessages,
  products,
  setProducts,
  editingProduct,
  setEditingProduct,
  newProduct,
  setNewProduct,
  setIsAddingProduct,
  setOrders,
  setPosts,
  setConversations,
  setCustomerNotes,
  newChannelInput,
  setNewChannelInput,
  setPendingConfirm,
}: UseChatAndCatalogActionsParams) {
  async function perform(path: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      await load();
      if (selected !== null) await loadMessages(selected);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Amal bajarilmadi");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!selected || !draft.trim()) return;
    const text = draft.trim();
    const ok = await perform(`/admin/conversations/${selected}/reply`, { text });
    if (ok) {
      setDraft("");
    }
  }

  const handleSaveCustomerNote = async (id: number, noteText: string) => {
    setBusy(true);
    try {
      const res = await api<{ ok: boolean; note: string }>(`/admin/conversations/${id}/note`, {
        method: "PUT",
        body: JSON.stringify({ notes: noteText }),
      });
      const savedNote = res?.note ?? noteText;
      setCustomerNotes((prev) => ({ ...prev, [id]: savedNote }));
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, note: savedNote } : c)));
      setSuccess("Operator eslatmasi bazaga saqlandi!");
    } catch (err: any) {
      setError(err?.message || "Eslatmani saqlashda xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  const handleSendCatalogProposal = () => {
    if (!products || products.length === 0) {
      setError("Katalogda hali mahsulotlar mavjud emas. Avval Mahsulotlar bo'limidan qo'shing.");
      return;
    }
    const itemsList = products.slice(0, 6).map((p, idx) => {
      const specsPart = p.specs ? ` (${p.specs})` : "";
      return `${idx + 1}. ${p.name} - ${p.price}${specsPart}`;
    });
    setDraft(
      "Assalomu alaykum! Do'konimizdagi eng ommabop mahsulotlar katalogi bilan tanishing:\n\n" +
        itemsList.join("\n") +
        "\n\nQaysi mahsulot bo'yicha batafsil ma'lumot beraylik?"
    );
    setSuccess("Do'kon katalogi taklifi xabar maydoniga tayyorlandi!");
  };

  const handleSendDiscountProposal = () => {
    setDraft(
      "Hurmatli mijoz, agar siz bugun buyurtmani tasdiqlasangiz, siz uchun maxsus 5% chegirma va bepul yetkazib berish xizmatini taqdim etamiz!"
    );
    setSuccess("Chegirma taklifi xabar maydoniga tayyorlandi!");
  };

  async function handleDeletePost(postId: number, msgId?: number) {
    setPendingConfirm({
      title: "Bilim bazasidan o'chirish",
      message: `#${msgId || postId} postni bazadan o'chirmoqchimisiz?`,
      confirmText: "O'chirish",
      onConfirm: async () => {
        await api(`/admin/knowledge/${postId}`, { method: "DELETE" });
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setSuccess(`#${msgId || postId} post bazadan muvaffaqiyatli o'chirildi!`);
      },
    });
  }

  const handleSaveProductEdit = async () => {
    if (!editingProduct) return;
    try {
      const res = await api<any>(`/admin/products/${encodeURIComponent(editingProduct.id)}`, {
        method: "PUT",
        body: JSON.stringify(editingProduct),
      });
      setProducts((prev) => prev.map((p) => (p.id === editingProduct.id ? { ...p, ...res } : p)));
      setSuccess(`${editingProduct.name} muvaffaqiyatli yangilandi!`);
      setEditingProduct(null);
    } catch (e: any) {
      setError(e.message || "Mahsulotni yangilashda xatolik");
    }
  };

  const handleCreateProduct = async () => {
    if (!newProduct.name || !newProduct.price) {
      setError("Iltimos, mahsulot nomi va narxini kiriting");
      return;
    }
    const newId = `PRD-${String(products.length + 1).padStart(2, "0")}`;
    const item: ProductItem = {
      id: newId,
      name: newProduct.name,
      category: newProduct.category || "General",
      specs: newProduct.specs || "Standart parametrlar",
      price: newProduct.price.startsWith("$") ? newProduct.price : `$${newProduct.price}`,
      stock: (newProduct.stock as any) || "In Stock",
      warranty: newProduct.warranty || "Mavjud",
    };
    try {
      const res = await api<any>("/admin/products", {
        method: "POST",
        body: JSON.stringify(item),
      });
      setProducts((prev) => [res || item, ...prev]);
      setSuccess(`${item.name} katalogga qo'shildi!`);
      setIsAddingProduct(false);
      setNewProduct({ category: "General", stock: "In Stock", warranty: "Mavjud" });
    } catch (e: any) {
      setError(e.message || "Mahsulotni qo'shishda xatolik");
    }
  };

  const handleExtractProductsFromPosts = async () => {
    setBusy(true);
    try {
      const res = await api<any>("/admin/products/extract-from-posts", { method: "POST" });
      if (res.extracted_count > 0) {
        setSuccess(`${res.extracted_count} ta yangi mahsulot kanal postlaridan aniqlandi va katalogga qo'shildi!`);
        const updated = await api<ProductItem[]>("/admin/products");
        setProducts(updated || []);
      } else {
        setSuccess("Kanal postlaridan yangi mahsulot topilmadi yoki barchasi avval qo'shilgan.");
      }
    } catch (e: any) {
      setError(e.message || "Mahsulotlarni aniqlashda xatolik");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateOrderStatus = async (orderIdStr: string, status: string) => {
    const rawId = parseInt(orderIdStr.replace("ORD-", ""), 10);
    try {
      await api(`/admin/orders/${rawId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderIdStr ? { ...o, status } : o)));
      setSuccess(`Buyurtma #${orderIdStr} statusi yangilandi: ${status}`);
    } catch (e: any) {
      setError(e.message || "Buyurtma statusini o'zgartirishda xatolik");
    }
  };

  const handleDeleteOrder = async (orderIdStr: string) => {
    setPendingConfirm({
      title: "Buyurtmani o'chirish",
      message: `${orderIdStr} buyurtmasini o'chirishga ishonchingiz komilmi?`,
      confirmText: "Ha, o'chirish",
      onConfirm: async () => {
        const rawId = parseInt(orderIdStr.replace("ORD-", ""), 10);
        await api(`/admin/orders/${rawId}`, { method: "DELETE" });
        setOrders((prev) => prev.filter((o) => o.id !== orderIdStr));
        setSuccess(`${orderIdStr} o'chirildi!`);
      },
    });
  };

  const handleDeleteProduct = async (prod: ProductItem) => {
    setPendingConfirm({
      title: "Mahsulotni o'chirish",
      message: `"${prod.name}" mahsulotini katalogdan o'chirishni tasdiqlaysizmi?`,
      confirmText: "O'chirish",
      onConfirm: async () => {
        await api(`/admin/products/${encodeURIComponent(prod.id)}`, { method: "DELETE" });
        setProducts((prev) => prev.filter((p) => p.id !== prod.id));
        setSuccess(`${prod.name} katalogdan o'chirildi!`);
      },
    });
  };

  async function handleSyncChannel(targetChannel?: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api<{ ok: boolean; synced: Record<string, number>; total_synced: number }>(
        "/admin/channels/sync",
        {
          method: "POST",
          body: targetChannel ? JSON.stringify({ channel: targetChannel }) : undefined,
        }
      );
      if (targetChannel) {
        setSuccess(`@${targetChannel} muvaffaqiyatli sinxronlandi (${res.total_synced} ta post)!`);
      } else {
        setSuccess(`Barcha kanallar muvaffaqiyatli sinxronlandi (Jami ${res.total_synced} ta post)!`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kanal postlarini sinxronlashda xatolik");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncKnowledge() {
    await handleSyncChannel();
  }

  async function handleConnectChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannelInput.trim()) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api<{ ok: boolean; channel: ConnectedChannel; imported_posts: number }>(
        "/admin/channels",
        {
          method: "POST",
          body: JSON.stringify({ channel: newChannelInput.trim() }),
        }
      );
      setSuccess(`@${res.channel.channel_username} kanali muvaffaqiyatli ulandi va ${res.imported_posts} ta post sinxronlandi!`);
      setNewChannelInput("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kanal ulashda xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteChannel(channelUsername: string) {
    setPendingConfirm({
      title: "Kanalni uzish",
      message: `@${channelUsername} kanalini ro'yxatdan o'chirmoqchimisiz?`,
      confirmText: "O'chirish",
      onConfirm: async () => {
        await api(`/admin/channels/${encodeURIComponent(channelUsername)}`, { method: "DELETE" });
        setSuccess(`@${channelUsername} kanali muvaffaqiyatli o'chirildi.`);
        await load();
      },
    });
  }

  return {
    perform,
    sendReply,
    handleSaveCustomerNote,
    handleSendCatalogProposal,
    handleSendDiscountProposal,
    handleDeletePost,
    handleSaveProductEdit,
    handleCreateProduct,
    handleExtractProductsFromPosts,
    handleUpdateOrderStatus,
    handleDeleteOrder,
    handleDeleteProduct,
    handleSyncKnowledge,
    handleConnectChannel,
    handleSyncChannel,
    handleDeleteChannel,
  };
}
