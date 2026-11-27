"use client";

import React, { useState } from "react";
import { useLanguage } from "../../lib/i18n";
import {
  IconPackage,
  IconSearch,
  IconPlus,
  IconSparkles,
  IconPencil,
  IconTrash,
  IconFilter,
  IconDownload,
  IconUpload,
} from "@tabler/icons-react";
import { downloadCsvExport } from "../../lib/csvExport";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Modal } from "../ui/Modal";
import { Input, Textarea } from "../ui/Input";
import { Select } from "../ui/Select";
import { PageHeader } from "../layout/PageHeader";

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  specs: string;
  price: string;
  stock: "In Stock" | "Low Stock" | "Pre-order";
  warranty: string;
}

export interface ProductsTabProps {
  products: ProductItem[];
  productSearch: string;
  setProductSearch: (s: string) => void;
  isAddingProduct: boolean;
  setIsAddingProduct: (b: boolean) => void;
  editingProduct: ProductItem | null;
  setEditingProduct: React.Dispatch<React.SetStateAction<ProductItem | null>> | ((p: ProductItem | null) => void);
  newProduct: Partial<ProductItem>;
  setNewProduct: React.Dispatch<React.SetStateAction<Partial<ProductItem>>> | ((p: Partial<ProductItem>) => void);
  onSaveProduct: () => void;
  onDeleteProduct: (p: any) => void;
  onExtractProducts: () => void;
  onBulkImportProducts?: (csvText: string) => Promise<boolean>;
  busy: boolean;
}

export function ProductsTab({
  products,
  productSearch,
  setProductSearch,
  isAddingProduct,
  setIsAddingProduct,
  editingProduct,
  setEditingProduct,
  newProduct,
  setNewProduct,
  onSaveProduct,
  onDeleteProduct,
  onExtractProducts,
  onBulkImportProducts,
  busy,
}: ProductsTabProps) {
  const { language, t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvImportText, setCsvImportText] = useState("");

  const categories = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);

  const filteredProducts = products.filter((prod) => {
    if (selectedCategory !== "all" && prod.category !== selectedCategory) return false;
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return (
      prod.name.toLowerCase().includes(q) ||
      prod.category.toLowerCase().includes(q) ||
      prod.specs.toLowerCase().includes(q) ||
      prod.id.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        breadcrumbs={t("breadcrumb.products")}
        title={t("products.title")}
        description={t("products.subtitle")}
        badge={{
          text: language === "uz" ? `${products.length} ta mahsulot` : `${products.length} items`,
          variant: "accent",
        }}
        actions={
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={filteredProducts.length === 0}
              onClick={() =>
                downloadCsvExport(
                  `mahsulotlar-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Kod", "Nomi", "Kategoriya", "Narx", "Zaxira", "Kafolat", "Xususiyatlar"],
                  filteredProducts.map((p) => [
                    p.id,
                    p.name,
                    p.category,
                    p.price,
                    p.stock,
                    p.warranty,
                    p.specs,
                  ])
                )
              }
              icon={<IconDownload size={14} />}
            >
              CSV Eksport
            </Button>
            {onBulkImportProducts && (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => setShowCsvImport(true)}
                icon={<IconUpload size={14} />}
              >
                {t("products.btn_csv_import")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onExtractProducts}
              disabled={busy}
              icon={<IconSparkles size={14} style={{ color: "var(--accent)" }} />}
            >
              {language === "uz" ? "Kanal postlaridan aniqlash" : "Extract from channel"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddingProduct(true)}
              icon={<IconPlus size={15} />}
            >
              {language === "uz" ? "Yangi mahsulot" : "Add Product"}
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader
          actions={
            <div className="d-flex align-items-center gap-2">
              {/* Category Filter */}
              {categories.length > 0 && (
                <div className="d-flex align-items-center gap-1.5">
                  <IconFilter size={14} className="text-secondary" />
                  <select
                    aria-label="Kategoriya bo'yicha saralash"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="linear-input py-1"
                    style={{ width: "auto", fontSize: "0.78rem" }}
                  >
                    <option value="all">{t("products.filter_all")}</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search */}
              <div className="position-relative" style={{ width: "200px" }}>
                <IconSearch
                  size={14}
                  className="position-absolute start-0 ms-2.5 top-50 translate-middle-y text-secondary"
                />
                <input
                  type="text"
                  placeholder={t("products.search_placeholder")}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="linear-input ps-5 py-1"
                  style={{ fontSize: "0.78rem" }}
                />
              </div>
            </div>
          }
        >
          <CardTitle>{t("products.title")} ({filteredProducts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={<IconPackage size={32} />}
              title={t("products.empty_products")}
              description={
                productSearch.trim() || selectedCategory !== "all"
                  ? language === "uz"
                    ? "Qidiruv yoki kategoriya filtri bo'yicha mahsulot topilmadi."
                    : language === "ru"
                    ? "По вашему фильтру или поиску товары не найдены."
                    : "No products matched your search or category filter."
                  : language === "uz"
                  ? "Katalogingiz bo'sh. Yangi mahsulot qo'shing yoki kanal postlaridan avtomatik aniqlang."
                  : language === "ru"
                  ? "Каталог пуст. Добавьте товар вручную или извлеките из постов канала."
                  : "Your catalog is empty. Add a product or extract items from channel posts."
              }
              actionLabel={language === "uz" ? "Yangi mahsulot" : language === "ru" ? "Добавить товар" : "Add Product"}
              onAction={() => setIsAddingProduct(true)}
            />
          ) : (
            <>
              <div className="d-none d-md-block table-responsive">
                <table className="linear-table">
                  <thead>
                    <tr>
                      <th style={{ width: "90px" }}>{t("products.th_sku")}</th>
                      <th>{t("products.th_name")}</th>
                      <th>{t("products.th_category")}</th>
                      <th>{t("products.th_specs")}</th>
                      <th>{t("products.th_price")}</th>
                      <th>{t("products.th_status")}</th>
                      <th>{t("products.th_warranty")}</th>
                      <th style={{ textAlign: "right" }}>{t("products.th_actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((prod) => (
                      <tr key={prod.id}>
                        <td className="font-monospace text-secondary small">
                          {prod.id}
                        </td>
                        <td className="fw-semibold text-primary">
                          {prod.name}
                        </td>
                        <td>
                          <Badge variant="accent">{prod.category}</Badge>
                        </td>
                        <td className="text-secondary small text-truncate" style={{ maxWidth: "260px" }}>
                          {prod.specs}
                        </td>
                        <td className="fw-bold text-success font-monospace">
                          {prod.price}
                        </td>
                        <td>
                          {prod.stock === "In Stock" ? (
                            <Badge variant="success">{t("products.stock_in")}</Badge>
                          ) : prod.stock === "Low Stock" ? (
                            <Badge variant="warning">{t("products.stock_low")}</Badge>
                          ) : (
                            <Badge variant="info">{t("products.stock_preorder")}</Badge>
                          )}
                        </td>
                        <td className="text-secondary small">{prod.warranty}</td>
                        <td style={{ textAlign: "right" }}>
                          <div className="d-flex align-items-center justify-content-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => setEditingProduct(prod)}
                              title={t("products.action_edit")}
                              aria-label={`${prod.name} ${t("products.action_edit")}`}
                              icon={<IconPencil size={13} />}
                            />
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => onDeleteProduct(prod)}
                              title={t("products.action_delete")}
                              aria-label={`${prod.name} ${t("products.action_delete")}`}
                              icon={<IconTrash size={13} />}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="d-md-none d-flex flex-column">
                {filteredProducts.map((prod) => (
                  <div key={`mob-prod-${prod.id}`} className="p-3 border-bottom border-subtle d-flex flex-column gap-2">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="min-w-0">
                        <div className="fw-semibold text-primary text-truncate">{prod.name}</div>
                        <div className="text-secondary small text-truncate">{prod.specs}</div>
                      </div>
                      <span className="fw-bold text-success font-monospace small flex-shrink-0">{prod.price}</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div className="d-flex align-items-center gap-1.5 flex-wrap">
                        <Badge variant="accent">{prod.category}</Badge>
                        {prod.stock === "In Stock" ? (
                          <Badge variant="success">{t("products.stock_in")}</Badge>
                        ) : prod.stock === "Low Stock" ? (
                          <Badge variant="warning">{t("products.stock_low")}</Badge>
                        ) : (
                          <Badge variant="info">{t("products.stock_preorder")}</Badge>
                        )}
                      </div>
                      <div className="d-flex align-items-center gap-1.5">
                        <Button variant="secondary" size="xs" onClick={() => setEditingProduct(prod)} aria-label={`${prod.name} ${t("products.action_edit")}`} icon={<IconPencil size={13} />} />
                        <Button variant="danger" size="xs" onClick={() => onDeleteProduct(prod)} aria-label={`${prod.name} ${t("products.action_delete")}`} icon={<IconTrash size={13} />} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Product Modal */}
      {(editingProduct || isAddingProduct) && (
        <Modal
          isOpen={true}
          onClose={() => {
            setEditingProduct(null);
            setIsAddingProduct(false);
          }}
          title={editingProduct ? `${editingProduct.name}: Tahrirlash` : "Yangi Mahsulot Qo'shish"}
          size="md"
          footer={
            <div className="d-flex justify-content-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingProduct(null);
                  setIsAddingProduct(false);
                }}
              >
                Bekor qilish
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onSaveProduct}
              >
                Saqlash
              </Button>
            </div>
          }
        >
          {editingProduct ? (
            <div className="d-flex flex-column gap-3">
              <Input
                label="Mahsulot Nomi"
                value={editingProduct.name}
                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                required
              />
              <div className="row g-2">
                <div className="col-6">
                  <Select
                    label="Kategoriya"
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    options={[
                      { value: "Gaming", label: "Gaming" },
                      { value: "Business", label: "Business" },
                      { value: "Ultrabook", label: "Ultrabook" },
                      { value: "Premium", label: "Premium" },
                    ]}
                  />
                </div>
                <div className="col-6">
                  <Input
                    label="Narxi"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                    placeholder="$450 yoki 5,200,000 so'm"
                    required
                  />
                </div>
              </div>
              <Textarea
                label="Xususiyatlari (Specs)"
                rows={2}
                value={editingProduct.specs}
                onChange={(e) => setEditingProduct({ ...editingProduct, specs: e.target.value })}
              />
              <div className="row g-2">
                <div className="col-6">
                  <Select
                    label="Holati"
                    value={editingProduct.stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, stock: e.target.value as any })}
                    options={[
                      { value: "In Stock", label: "Mavjud (In Stock)" },
                      { value: "Low Stock", label: "Kam qoldi (Low Stock)" },
                      { value: "Pre-order", label: "Buyurtmaga (Pre-order)" },
                    ]}
                  />
                </div>
                <div className="col-6">
                  <Input
                    label="Kafolat"
                    value={editingProduct.warranty}
                    onChange={(e) => setEditingProduct({ ...editingProduct, warranty: e.target.value })}
                    placeholder="3 oy kafolat"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="d-flex flex-column gap-3">
              <Input
                label="Mahsulot Nomi"
                value={newProduct.name || ""}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                placeholder="Masalan: Lenovo Legion 5 Pro"
                required
              />
              <div className="row g-2">
                <div className="col-6">
                  <Select
                    label="Kategoriya"
                    value={newProduct.category || "Gaming"}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    options={[
                      { value: "Gaming", label: "Gaming" },
                      { value: "Business", label: "Business" },
                      { value: "Ultrabook", label: "Ultrabook" },
                      { value: "Premium", label: "Premium" },
                    ]}
                  />
                </div>
                <div className="col-6">
                  <Input
                    label="Narxi"
                    value={newProduct.price || ""}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="$650"
                    required
                  />
                </div>
              </div>
              <Textarea
                label="Xususiyatlari (Specs)"
                rows={2}
                value={newProduct.specs || ""}
                onChange={(e) => setNewProduct({ ...newProduct, specs: e.target.value })}
                placeholder="i7-12700H, 16GB RAM, 512GB SSD, RTX 3060"
              />
              <div className="row g-2">
                <div className="col-6">
                  <Select
                    label="Holati"
                    value={newProduct.stock || "In Stock"}
                    onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value as any })}
                    options={[
                      { value: "In Stock", label: "Mavjud (In Stock)" },
                      { value: "Low Stock", label: "Kam qoldi (Low Stock)" },
                      { value: "Pre-order", label: "Buyurtmaga (Pre-order)" },
                    ]}
                  />
                </div>
                <div className="col-6">
                  <Input
                    label="Kafolat"
                    value={newProduct.warranty || "2 oy kafolat"}
                    onChange={(e) => setNewProduct({ ...newProduct, warranty: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* CSV Bulk Import Modal */}
      {showCsvImport && (
        <Modal
          isOpen={true}
          onClose={() => setShowCsvImport(false)}
          title={t("products.modal_import_title")}
          size="md"
          footer={
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowCsvImport(false)}>
                {t("payments.close")}
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={busy}
                disabled={!csvImportText.trim()}
                onClick={async () => {
                  if (!onBulkImportProducts) return;
                  const ok = await onBulkImportProducts(csvImportText);
                  if (ok) {
                    setCsvImportText("");
                    setShowCsvImport(false);
                  }
                }}
              >
                {t("products.btn_import_submit")}
              </Button>
            </div>
          }
        >
          <div className="d-flex flex-column gap-3">
            <div>
              <label className="small text-secondary d-block mb-1">
                CSV fayl tanlang (ustunlar: <code className="text-primary">name,category,price,specs,stock,warranty</code>)
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                className="linear-input"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCsvImportText(await file.text());
                }}
              />
            </div>
            <Textarea
              label="Yoki CSV matnni bu yerga joylang"
              rows={6}
              value={csvImportText}
              onChange={(e) => setCsvImportText(e.target.value)}
              placeholder={"name,category,price,specs,stock,warranty\niPhone 16 Pro,Smartphones,14500000 so'm,256GB Desert Titanium,In Stock,1 yil"}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
