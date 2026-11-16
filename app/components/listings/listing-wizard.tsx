"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Combobox } from "~/components/ui/combobox";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { ImageUploader } from "./image-uploader";
import { PaymentModal } from "./payment-modal";
import { listingSchema, type ListingInput } from "~/lib/validation";
import {
  createListing,
  fetchSellerListingEligibility,
  submitShopListing,
} from "~/server/listings.functions";
import {
  fetchCategoryConditions,
  fetchCategoryMetadataSchema,
  listChildCategories,
  type CategoryConditionItem,
} from "~/server/categories.functions";
import { getListingPricingPreview } from "~/server/config.functions";
import { updateListing } from "~/server/listing-edit.functions";
import type { EditableListing } from "~/lib/listing-edit";
import {
  DELIVERY_METHODS,
  WALLET_PROVIDERS,
} from "~/db/schema";
import { formatDate, formatPrice } from "~/lib/format";
import {
  calculateListingPricing,
  findListingTier,
  minimumTierPriceCents,
  type ListingTiersConfig,
  type ListingPricing,
  type MonetizationModel,
} from "~/lib/pricing";
import {
  validateMetadata,
  normalizeMetadataValue,
  formatMetadataValue,
  isEmptyMetadataValue,
  getVisibleFields,
  stripHiddenMetadata,
  CONDITION_GROUP_KEYS,
  type CategoryMetadataSchema,
} from "~/lib/category-metadata";
import { MetadataFieldInput } from "./metadata-field-input";
import { ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from "lucide-react";
import type { CategoryListItem } from "~/server/categories.functions";

interface FeatureToggles {
  localPickupEnabled: boolean;
  platformShippingEnabled: boolean;
  evcEnabled: boolean;
  premierWalletEnabled: boolean;
  edahabEnabled: boolean;
}

interface ListingWizardProps {
  sellerId: string;
  categories: CategoryListItem[];
  tiersConfig: ListingTiersConfig;
  monetizationModel: MonetizationModel;
  featureToggles: FeatureToggles;
  /** When set, the wizard edits this listing instead of creating one. */
  editListing?: EditableListing;
}

const STEPS = ["Details", "Pricing", "Photos", "Review"];
const STEP_1_KEYS = new Set(["price", "deliveryMethod"]);
const STEP_2_KEYS = new Set(["images"]);

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/** Stored image URLs -> uploader entries (path/name are display keys only). */
function toImageInputs(urls: string[]): ListingInput["images"] {
  return urls.map((url, idx) => {
    const tail = decodeURIComponent(url.split("?")[0].split("/").pop() || "");
    return { url, path: tail || `image-${idx + 1}`, name: tail || `Photo ${idx + 1}` };
  });
}

function formFromListing(listing: EditableListing): ListingInput {
  const legacyCondition =
    typeof listing.metadata.condition === "string" ? listing.metadata.condition : null;
  return {
    title: listing.title,
    description: listing.description,
    categoryId: listing.categoryId,
    condition: listing.condition ?? legacyCondition,
    price: listing.price,
    deliveryMethod: listing.deliveryMethod,
    images: toImageInputs(listing.images),
    metadata: listing.metadata,
  };
}

const emptyForm: ListingInput = {
  title: "",
  description: "",
  categoryId: "",
  condition: null,
  price: 0,
  deliveryMethod: "local_pickup",
  images: [],
  metadata: {},
};

export function ListingWizard({
  sellerId,
  categories,
  tiersConfig,
  monetizationModel,
  featureToggles,
  editListing,
}: ListingWizardProps) {
  const isEdit = Boolean(editListing);
  // Drafts are not published yet: saving continues into the normal publish /
  // payment flow. Other edits only save (and may return to review).
  const isDraftEdit = editListing?.status === "draft";
  const runsPublishFlow = !isEdit || isDraftEdit;
  const enabledDeliveryMethods = useMemo(() => {
    return DELIVERY_METHODS.filter((m) => {
      if (m === "shipping") return featureToggles.platformShippingEnabled;
      if (m === "local_pickup") return featureToggles.localPickupEnabled;
      return featureToggles.platformShippingEnabled && featureToggles.localPickupEnabled;
    });
  }, [featureToggles]);

  const enabledWalletProviders = useMemo(() => {
    return WALLET_PROVIDERS.filter((p) => {
      if (p === "evc") return featureToggles.evcEnabled;
      if (p === "premier") return featureToggles.premierWalletEnabled;
      if (p === "edahab") return featureToggles.edahabEnabled;
      return true;
    });
  }, [featureToggles]);

  const defaultDeliveryMethod = enabledDeliveryMethods[0] ?? "local_pickup";

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ListingInput>(() =>
    editListing
      ? formFromListing(editListing)
      : {
          ...emptyForm,
          deliveryMethod: defaultDeliveryMethod as ListingInput["deliveryMethod"],
        }
  );

  // If toggles change and the selected delivery method is no longer available,
  // fall back to the first enabled option.
  useEffect(() => {
    if (!enabledDeliveryMethods.includes(form.deliveryMethod)) {
      setForm((prev) => ({
        ...prev,
        deliveryMethod: defaultDeliveryMethod as ListingInput["deliveryMethod"],
      }));
    }
  }, [enabledDeliveryMethods, defaultDeliveryMethod, form.deliveryMethod]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [serverFeeCents, setServerFeeCents] = useState<number>(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submittedForReview, setSubmittedForReview] = useState(false);
  const [savedEdit, setSavedEdit] = useState<{
    status: string;
    previousStatus: string;
  } | null>(null);
  const [eligibility, setEligibility] = useState<{
    sellerType: "individual" | "shop";
    canList: boolean;
    requiresPayment: boolean;
    remainingListings: number | null;
  } | null>(null);
  const [categoryConditions, setCategoryConditions] = useState<
    CategoryConditionItem[]
  >([]);
  const [metadataSchema, setMetadataSchema] = useState<CategoryMetadataSchema | null>(null);
  const [parentCategoryId, setParentCategoryId] = useState<string>(
    editListing ? editListing.parentCategoryId ?? editListing.categoryId : ""
  );
  const [subcategories, setSubcategories] = useState<CategoryListItem[]>([]);

  useEffect(() => {
    fetchSellerListingEligibility().then(setEligibility);
  }, [sellerId]);

  useEffect(() => {
    if (!parentCategoryId) {
      setSubcategories([]);
      return;
    }
    listChildCategories({ data: { parentId: parentCategoryId } }).then(
      setSubcategories
    );
  }, [parentCategoryId]);

  useEffect(() => {
    if (!form.categoryId) {
      setCategoryConditions([]);
      setMetadataSchema(null);
      return;
    }
    fetchCategoryConditions({ data: { categoryId: form.categoryId } }).then(
      setCategoryConditions
    );
    fetchCategoryMetadataSchema({ data: { categoryId: form.categoryId } }).then(
      setMetadataSchema
    );
  }, [form.categoryId]);

  useEffect(() => {
    setForm((prev) => {
      if (!prev.condition) return prev;
      if (
        categoryConditions.length > 0 &&
        !categoryConditions.some((c) => c.code === prev.condition)
      ) {
        return { ...prev, condition: null };
      }
      return prev;
    });
  }, [categoryConditions]);

  const updateField = <K extends keyof ListingInput>(key: K, value: ListingInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateMetadata = (key: string, value: unknown) => {
    const field = metadataSchema?.fields.find((f) => f.key === key);
    const normalized = field ? normalizeMetadataValue(field.type, value) : null;
    // Changing a parent field can hide conditional children; drop their
    // values so stale answers are never submitted.
    setForm((prev) => ({
      ...prev,
      metadata: stripHiddenMetadata(
        metadataSchema,
        { ...prev.metadata, [key]: normalized },
        { condition: prev.condition ?? null }
      ),
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  /** Earliest wizard step that owns one of the given error keys. */
  const firstStepWithError = (fieldErrors: Record<string, string>) => {
    const keys = Object.keys(fieldErrors).filter((k) => k !== "submit");
    if (keys.some((k) => !STEP_1_KEYS.has(k) && !STEP_2_KEYS.has(k))) return 0;
    if (keys.some((k) => STEP_1_KEYS.has(k))) return 1;
    if (keys.some((k) => STEP_2_KEYS.has(k))) return 2;
    return null;
  };

  /** The listing condition can also gate conditional category fields. */
  const updateCondition = (condition: string | null) => {
    setForm((prev) => ({
      ...prev,
      condition,
      metadata: stripHiddenMetadata(metadataSchema, prev.metadata, { condition }),
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.condition;
      return next;
    });
  };

  /** Errors for the Details step: listing condition + category details. */
  const detailErrors = () => {
    const fieldErrors = validateMetadata(metadataSchema, form.metadata, {
      condition: form.condition ?? null,
    });
    if (categoryConditions.length > 0 && !form.condition) {
      fieldErrors.condition = "Condition is required";
    }
    return fieldErrors;
  };

  const validateStep = () => {
    const result = listingSchema.safeParse(form);
    const metadataErrors = detailErrors();
    if (!result.success || Object.keys(metadataErrors).length > 0) {
      const fieldErrors: Record<string, string> = { ...metadataErrors };
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          const path = issue.path[0] as string;
          if (!fieldErrors[path]) fieldErrors[path] = issue.message;
        });
      }
      setErrors(fieldErrors);
      const errorStep = firstStepWithError(fieldErrors);
      if (errorStep !== null) setStep(errorStep);
      return false;
    }
    setErrors({});
    return true;
  };

  const visibleFields = useMemo(
    () => getVisibleFields(metadataSchema, form.metadata, { condition: form.condition ?? null }),
    [metadataSchema, form.metadata, form.condition]
  );
  // Warranty questions sit with Condition; everything else is a category detail.
  const conditionGroupFields = useMemo(
    () => visibleFields.filter((f) => CONDITION_GROUP_KEYS.has(f.key)),
    [visibleFields]
  );
  const detailGroupFields = useMemo(
    () => visibleFields.filter((f) => !CONDITION_GROUP_KEYS.has(f.key)),
    [visibleFields]
  );

  const canProceed = useMemo(() => {
    if (step === 0) {
      return form.title.length >= 5 && form.description.length >= 20 && form.categoryId;
    }
    if (step === 1) {
      // A price must fall in a fee tier before the seller can continue.
      return findListingTier(form.price, tiersConfig) !== null && form.deliveryMethod;
    }
    if (step === 2) {
      return form.images.length > 0;
    }
    return true;
  }, [step, form, tiersConfig]);

  const minimumPriceCents = useMemo(() => minimumTierPriceCents(tiersConfig), [tiersConfig]);
  const priceBelowMinimum = form.price > 0 && findListingTier(form.price, tiersConfig) === null;

  const [preview, setPreview] = useState<ListingPricing>(() =>
    calculateListingPricing(form.price, tiersConfig, {
      monetizationModel,
    })
  );

  const rootCategoryOptions = useMemo(
    () => categories.map((cat) => ({ value: cat.id, label: cat.name })),
    [categories]
  );
  const subcategoryOptions = useMemo(
    () => subcategories.map((cat) => ({ value: cat.id, label: cat.name })),
    [subcategories]
  );
  const allCategories = useMemo(
    () => [...categories, ...subcategories],
    [categories, subcategories]
  );
  const conditionOptions = useMemo(
    () => categoryConditions.map((c) => ({ value: c.code, label: c.label })),
    [categoryConditions]
  );
  const deliveryOptions = useMemo(
    () => DELIVERY_METHODS.map((m) => ({ value: m, label: titleCase(m) })),
    []
  );
  useEffect(() => {
    let cancelled = false;
    const local = () =>
      setPreview(calculateListingPricing(form.price, tiersConfig, { monetizationModel }));
    // Empty / below-minimum price: show the neutral summary immediately and
    // never ask the server for a fee.
    if (!form.categoryId || findListingTier(form.price, tiersConfig) === null) {
      local();
      return;
    }
    const timeout = setTimeout(() => {
      getListingPricingPreview({
        data: {
          price: form.price,
          categoryId: form.categoryId,
        },
      })
        .then((next) => {
          // Ignore a slow reply for a price the seller has since changed or
          // cleared, so a stale Premium fee can't reappear.
          if (!cancelled) setPreview(next);
        })
        .catch(() => {
          if (!cancelled) local();
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [form.price, form.condition, form.categoryId, tiersConfig, monetizationModel]);

  const handleNext = () => {
    if (step === 0) {
      const metadataErrors = detailErrors();
      if (Object.keys(metadataErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...metadataErrors }));
        return;
      }
    }
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    if (runsPublishFlow && !eligibility?.canList) return;
    setSubmitting(true);
    try {
      let result: { id: string; feeCents?: number | null };
      if (editListing) {
        const saved = await updateListing({
          data: { id: editListing.id, listing: form },
        });
        if (saved.status !== "draft") {
          setSavedEdit({ status: saved.status, previousStatus: saved.previousStatus });
          return;
        }
        result = saved;
      } else {
        result = await createListing({
          data: { listing: form },
        });
      }
      if (!eligibility) return;
      setCreatedListingId(result.id);
      setServerFeeCents(result.feeCents ?? 0);

      if (eligibility.requiresPayment) {
        setPaymentOpen(true);
      } else {
        await submitShopListing({
          data: { listingId: result.id },
        });
        setSubmittedForReview(true);
      }
    } catch (err) {
      setErrors({
        submit:
          err instanceof Error
            ? err.message
            : isEdit
            ? "Failed to save changes"
            : "Failed to create listing",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (savedEdit) {
    const backToReview =
      savedEdit.status === "pending_review" && savedEdit.previousStatus !== "pending_review";
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-celis-success" />
          <h2 className="text-2xl font-semibold">
            {backToReview ? "Changes sent for review" : "Changes saved"}
          </h2>
          <p className="text-celis-ink-secondary">
            {savedEdit.previousStatus === "active"
              ? "Your listing is hidden while an admin reviews your changes. It will appear publicly again once approved."
              : backToReview
              ? "Your updated listing is waiting for admin approval."
              : "Your listing is still waiting for admin approval."}
          </p>
          <Button asChild>
            <a href="/dashboard">Go to dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (submittedForReview) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <CheckCircle2 className="h-16 w-16 text-celis-success" />
          <h2 className="text-2xl font-semibold">Listing submitted for review</h2>
          <p className="text-celis-ink-secondary">
            Your listing is waiting for admin approval. It will appear publicly
            after review.
          </p>
          <Button asChild>
            <a href="/dashboard">Go to dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="mx-auto max-w-3xl">
        <CardHeader>
          <CardTitle>{isEdit ? "Edit listing" : "Sell an item"}</CardTitle>
          <CardDescription>
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </CardDescription>
          <div className="mt-4 flex gap-1">
            {STEPS.map((label, idx) => (
              <div
                key={label}
                className={`h-2.5 flex-1 rounded-full ${
                  idx <= step ? "bg-celis-primary" : "bg-celis-border"
                }`}
                aria-label={label}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {isEdit && editListing?.status === "active" && (
            <div
              role="status"
              className="rounded-lg border border-celis-caution bg-celis-caution-subtle p-4 text-sm text-celis-ink"
            >
              This listing is live. Saving changes hides it until an admin approves the update.
            </div>
          )}
          {runsPublishFlow && eligibility?.canList === false && (
            <div
              role="status"
              className="space-y-2 rounded-lg border border-celis-caution bg-celis-caution-subtle p-4 text-sm text-celis-ink"
            >
              {eligibility.sellerType === "shop"
                ? <>
                    <p className="font-semibold">Publishing is disabled because this shop has 0 listing credits remaining.</p>
                    <p>Activate or renew a listing package to publish more items.</p>
                    <a
                      href="mailto:hello@celis.so?subject=Listing%20package%20activation"
                      className="inline-block font-medium text-celis-primary underline underline-offset-2"
                    >
                      Contact Celis support to request activation
                    </a>
                  </>
                : "You cannot publish right now. Please check your account status."}
            </div>
          )}
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="What are you selling?"
                />
                {errors.title && <p className="text-sm text-celis-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="parentCategory">Category</Label>
                <Combobox
                  value={parentCategoryId}
                  disabled={isEdit}
                  onValueChange={(v) => {
                    setParentCategoryId(v);
                    setForm((prev) => ({
                      ...prev,
                      categoryId: "",
                      condition: null,
                      metadata: {},
                    }));
                  }}
                  placeholder="Select a category"
                  searchPlaceholder="Search categories..."
                  options={rootCategoryOptions}
                />
              </div>

              {parentCategoryId && subcategoryOptions.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategory</Label>
                  <Combobox
                    value={form.categoryId}
                    disabled={isEdit}
                    onValueChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        categoryId: v,
                        condition: null,
                        metadata: {},
                      }))
                    }
                    placeholder="Select a subcategory"
                    searchPlaceholder="Search subcategories..."
                    options={subcategoryOptions}
                  />
                  {errors.categoryId && (
                    <p className="text-sm text-celis-destructive">{errors.categoryId}</p>
                  )}
                </div>
              )}

              {form.categoryId &&
                (conditionOptions.length > 0 || conditionGroupFields.length > 0) && (
                <div className="space-y-4 rounded-lg border border-celis-border bg-celis-surface-inset p-4">
                  <h3 className="text-sm font-medium text-celis-ink">
                    {conditionGroupFields.length > 0 ? "Condition & Warranty" : "Condition"}
                  </h3>
                  {conditionOptions.length > 0 && (
                    <div className="space-y-2">
                      <Label htmlFor="condition">
                        Condition
                        <span className="text-celis-destructive"> *</span>
                      </Label>
                      <Combobox
                        value={form.condition ?? undefined}
                        onValueChange={(v) => updateCondition(v || null)}
                        options={conditionOptions}
                        placeholder="Select condition"
                        label="Condition"
                      />
                      {errors.condition && (
                        <p className="text-sm text-celis-destructive">{errors.condition}</p>
                      )}
                    </div>
                  )}
                  {conditionGroupFields.map((field) => (
                    <MetadataFieldInput
                      key={field.key}
                      field={field}
                      value={form.metadata[field.key]}
                      error={errors[field.key]}
                      onChange={(value) => updateMetadata(field.key, value)}
                    />
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe the item, its condition, and any defects."
                  rows={5}
                />
                {errors.description && (
                  <p className="text-sm text-celis-destructive">{errors.description}</p>
                )}
              </div>

              {detailGroupFields.length > 0 && (
                <div className="space-y-4 rounded-lg border border-celis-border bg-celis-surface-inset p-4">
                  <h3 className="text-sm font-medium text-celis-ink">
                    Category details
                  </h3>
                  {detailGroupFields.map((field) => (
                    <MetadataFieldInput
                      key={field.key}
                      field={field}
                      value={form.metadata[field.key]}
                      error={errors[field.key]}
                      onChange={(value) => updateMetadata(field.key, value)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-celis-ink-secondary">$</span>
                  <Input
                    id="price"
                    type="number"
                    min={1}
                    step={1}
                    className="pl-7"
                    value={form.price / 100 || ""}
                    onChange={(e) =>
                      updateField("price", Math.round(parseFloat(e.target.value || "0") * 100))
                    }
                    placeholder="0.00"
                  />
                </div>
                {errors.price && <p className="text-sm text-celis-destructive">{errors.price}</p>}
                {!errors.price && priceBelowMinimum && Number.isFinite(minimumPriceCents) && (
                  <p className="text-sm text-celis-destructive">
                    Enter a price of at least {formatPrice(minimumPriceCents)}.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryMethod">Delivery</Label>
                <Combobox
                  value={form.deliveryMethod}
                  onValueChange={(v) => updateField("deliveryMethod", v as typeof form.deliveryMethod)}
                  options={deliveryOptions}
                />

              </div>

              {/* Fixed fee tiers only apply when the platform charges listing
                  fees (fixed_only / hybrid); commission-only shows no tiers. */}
              {monetizationModel !== "commission_only" && (
              <div className="rounded-lg border border-celis-border bg-celis-surface-inset p-4 text-sm text-celis-ink-secondary">
                <p className="mb-2 font-medium text-celis-ink">Listing fee tiers</p>
                <ul className="space-y-1">
                  {tiersConfig.tiers.map((tier) => {
                    const min = tier.minCents / 100;
                    const max = tier.maxCents === null ? null : tier.maxCents / 100;
                    const range = max === null
                      ? `$${min.toLocaleString("en-US")}+`
                      : `$${min.toLocaleString("en-US")} – $${max.toLocaleString("en-US")}`;
                    return (
                      <li
                        key={tier.label}
                        className={`flex items-center justify-between ${
                          preview.tierLabel === tier.label
                            ? "font-medium text-celis-ink"
                            : ""
                        }`}
                      >
                        <span>
                          {tier.label}: {range}
                        </span>
                        <span>{formatPrice(tier.feeCents)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              )}

              {!preview.priced ? (
              <div
                role="status"
                className="rounded-lg border border-celis-border bg-celis-surface-inset p-4 text-sm text-celis-ink-secondary"
              >
                Enter a price to calculate the listing fee.
              </div>
              ) : (
              <div className="rounded-lg border border-celis-border bg-celis-surface-inset p-4 text-sm text-celis-ink-secondary">
                <p className="font-medium text-celis-ink">
                  {preview.tierLabel} tier
                </p>
                {preview.feeCents > 0 && (
                  <p>
                    Listing fee:{" "}
                    <strong className="text-celis-ink">
                      {formatPrice(preview.feeCents)}
                    </strong>
                  </p>
                )}
                {preview.commissionAmountCents !== null && preview.commissionAmountCents > 0 && (
                  <p>
                    Commission ({(preview.commissionBps ?? 0) / 100}%):{" "}
                    <strong className="text-celis-ink">
                      {formatPrice(preview.commissionAmountCents)}
                    </strong>
                  </p>
                )}
                {preview.totalFeeCents > 0 && (
                  <p>
                    Total charge:{" "}
                    <strong className="text-celis-ink">
                      {formatPrice(preview.totalFeeCents)}
                    </strong>
                  </p>
                )}
                <p>Expires on {formatDate(preview.expiresAt)}.</p>
              </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <ImageUploader
                sellerId={sellerId}
                images={form.images}
                onChange={(imgs) => updateField("images", imgs)}
              />
              {errors.images && <p className="text-sm text-celis-destructive">{errors.images}</p>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-medium">Review your listing</h3>
              <dl className="divide-y divide-celis-border text-sm">
                <div className="flex justify-between py-2">
                  <dt className="text-celis-ink-secondary">Title</dt>
                  <dd className="max-w-[60%] text-right font-medium">{form.title}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-celis-ink-secondary">Category</dt>
                  <dd className="font-medium">
                    {allCategories.find((c) => c.id === form.categoryId)?.name ?? "—"}
                  </dd>
                </div>
                {categoryConditions.length > 0 && (
                  <div className="flex justify-between py-2">
                    <dt className="text-celis-ink-secondary">Condition</dt>
                    <dd
                      className={`font-medium ${form.condition ? "" : "text-celis-destructive"}`}
                    >
                      {categoryConditions.find((c) => c.code === form.condition)?.label ??
                        form.condition?.replace(/_/g, " ") ??
                        "Required"}
                    </dd>
                  </div>
                )}
                {visibleFields.map((field) => {
                    const value = form.metadata[field.key];
                    const empty = isEmptyMetadataValue(value);
                    // Optional details the seller skipped are not shown.
                    if (empty && !field.required) return null;
                    return (
                      <div key={field.key} className="flex justify-between gap-4 py-2">
                        <dt className="text-celis-ink-secondary">{field.label}</dt>
                        <dd
                          className={`max-w-[60%] text-right font-medium ${
                            empty ? "text-celis-destructive" : ""
                          }`}
                        >
                          {empty ? "Required" : formatMetadataValue(field, value)}
                        </dd>
                      </div>
                    );
                  })}
                <div className="flex justify-between py-2">
                  <dt className="text-celis-ink-secondary">Price</dt>
                  <dd className="font-medium">{formatPrice(form.price)}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-celis-ink-secondary">Delivery</dt>
                  <dd className="font-medium">{form.deliveryMethod.replace(/_/g, " ")}</dd>
                </div>
                <div className="flex justify-between py-2">
                  <dt className="text-celis-ink-secondary">Listing fee</dt>
                  <dd className="font-medium">
                    {preview.feeCents > 0 ? formatPrice(preview.feeCents) : "—"}
                  </dd>
                </div>
                {preview.commissionAmountCents !== null && preview.commissionAmountCents > 0 && (
                  <div className="flex justify-between py-2">
                    <dt className="text-celis-ink-secondary">Commission</dt>
                    <dd className="font-medium">
                      {formatPrice(preview.commissionAmountCents)} ({(preview.commissionBps ?? 0) / 100}%)
                    </dd>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <dt className="text-celis-ink-secondary">Expires</dt>
                  <dd className="font-medium">
                    {formatDate(preview.expiresAt)}
                  </dd>
                </div>
              </dl>
              <p className="text-sm text-celis-ink-secondary">
                {form.description}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {form.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.url}
                    alt=""
                    className="aspect-square rounded-md object-cover"
                  />
                ))}
              </div>
              {errors.submit && (
                <p className="text-sm text-celis-destructive">{errors.submit}</p>
              )}
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between border-t border-celis-border pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={handleNext} disabled={!canProceed}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={
                !canProceed || submitting || (runsPublishFlow && eligibility?.canList === false)
              }
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {!runsPublishFlow
                ? "Save changes"
                : eligibility?.requiresPayment
                ? `Publish & pay ${formatPrice(serverFeeCents || preview.totalFeeCents)}`
                : eligibility?.sellerType === "shop"
                ? `Publish (package: ${
                    eligibility?.remainingListings === null
                      ? "Unlimited"
                      : `${eligibility?.remainingListings} left`
                  })`
                : "Publish"}
            </Button>
          )}
        </CardFooter>
      </Card>

      <PaymentModal
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        userId={sellerId}
        listingId={createdListingId}
        amountCents={serverFeeCents || preview.totalFeeCents}
        enabledProviders={enabledWalletProviders}
        onSuccess={() => setSubmittedForReview(true)}
      />
    </>
  );
}
