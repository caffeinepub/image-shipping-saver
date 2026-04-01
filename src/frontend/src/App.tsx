import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Calculator,
  ChevronDown,
  Clipboard,
  Download,
  ImageIcon,
  Loader2,
  Package,
  TrendingDown,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CompressionLevel {
  label: string;
  labelHindi: string;
  quality: number;
  color: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
}

interface CompressedResult {
  level: CompressionLevel;
  blob: Blob;
  url: string;
  size: number;
  percent: number;
  width: number;
  height: number;
}

interface SourceInfo {
  name: string;
  size: number;
  width: number;
  height: number;
  url: string;
}

// ─── Shipping Rate Tables ─────────────────────────────────────────────────────
const PLATFORMS = [
  {
    name: "Meesho",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    rates: { s500: 50, s1000: 65, s2000: 85, s5000: 115 },
  },
  {
    name: "Flipkart",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    rates: { s500: 55, s1000: 72, s2000: 92, s5000: 122 },
  },
  {
    name: "Amazon",
    color: "text-orange-700",
    bg: "bg-orange-50",
    border: "border-orange-200",
    rates: { s500: 52, s1000: 68, s2000: 88, s5000: 118 },
  },
  {
    name: "Shiprocket",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    rates: { s500: 50, s1000: 65, s2000: 82, s5000: 110 },
  },
];

function getChargeForWeight(
  rates: { s500: number; s1000: number; s2000: number; s5000: number },
  grams: number,
): number {
  if (grams <= 500) return rates.s500;
  if (grams <= 1000) return rates.s1000;
  if (grams <= 2000) return rates.s2000;
  return rates.s5000;
}

function getSlabLabel(grams: number): string {
  if (grams <= 500) return "0–500g slab";
  if (grams <= 1000) return "501–1000g slab";
  if (grams <= 2000) return "1001–2000g slab";
  return "2001–5000g slab";
}

// ─── Constants ───────────────────────────────────────────────────────────────
const COMPRESSION_LEVELS: CompressionLevel[] = [
  {
    label: "High Quality",
    labelHindi: "उच्च गुणवत्ता",
    quality: 0.9,
    color: "bg-green-100 text-green-800",
    badgeVariant: "outline",
  },
  {
    label: "Optimal Balance",
    labelHindi: "संतुलित",
    quality: 0.7,
    color: "bg-blue-100 text-blue-800",
    badgeVariant: "secondary",
  },
  {
    label: "Max Compress",
    labelHindi: "अधिकतम संपीड़न",
    quality: 0.5,
    color: "bg-yellow-100 text-yellow-800",
    badgeVariant: "secondary",
  },
  {
    label: "Ultra Compress",
    labelHindi: "अल्ट्रा कम्प्रेस",
    quality: 0.3,
    color: "bg-orange-100 text-orange-800",
    badgeVariant: "secondary",
  },
  {
    label: "Thumbnail",
    labelHindi: "थंबनेल",
    quality: 0.15,
    color: "bg-red-100 text-red-800",
    badgeVariant: "destructive",
  },
];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function compressImage(
  file: File | Blob,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context failed"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Compression failed"));
            return;
          }
          resolve({ blob, width: img.naturalWidth, height: img.naturalHeight });
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
    img.src = url;
  });
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [source, setSource] = useState<SourceInfo | null>(null);
  const [results, setResults] = useState<CompressedResult[]>([]);
  const [weightInput, setWeightInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const prevBlobUrls = useRef<string[]>([]);

  const weightGrams = Number(weightInput);
  const isValidWeight = weightGrams > 0 && weightGrams <= 5000;

  // Cleanup blob URLs on unmount
  useEffect(() => {
    const urls = prevBlobUrls.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, []);

  const processFile = useCallback(
    async (file: File | Blob, filename = "product.jpg") => {
      const MAX_SIZE = 25 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        toast.error("File too large. Max 25MB allowed.");
        return;
      }
      const ext = (file as File).name?.split(".").pop()?.toLowerCase() ?? "jpg";
      if (
        !["jpg", "jpeg", "png", "webp"].includes(ext) &&
        file.type &&
        !file.type.startsWith("image/")
      ) {
        toast.error("Only JPG, PNG, WEBP images are supported.");
        return;
      }

      for (const u of prevBlobUrls.current) URL.revokeObjectURL(u);
      prevBlobUrls.current = [];

      setIsCompressing(true);
      setResults([]);
      setSource(null);

      try {
        const srcUrl = URL.createObjectURL(file);
        prevBlobUrls.current.push(srcUrl);
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = srcUrl;
        });

        const srcInfo: SourceInfo = {
          name: (file as File).name ?? filename,
          size: file.size,
          width: img.naturalWidth,
          height: img.naturalHeight,
          url: srcUrl,
        };
        setSource(srcInfo);

        const compressed = await Promise.all(
          COMPRESSION_LEVELS.map(async (level) => {
            const { blob, width, height } = await compressImage(
              file,
              level.quality,
            );
            const url = URL.createObjectURL(blob);
            prevBlobUrls.current.push(url);
            const percent = Math.round(
              ((file.size - blob.size) / file.size) * 100,
            );
            return {
              level,
              blob,
              url,
              size: blob.size,
              percent,
              width,
              height,
            } satisfies CompressedResult;
          }),
        );

        setResults(compressed);
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      } catch (_err) {
        toast.error("Failed to process image. Please try again.");
      } finally {
        setIsCompressing(false);
      }
    },
    [],
  );

  const handleFile = useCallback(
    (file: File) => {
      processFile(file, file.name);
    },
    [processFile],
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) processFile(blob, "pasted-image.jpg");
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [processFile]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDownload = (result: CompressedResult) => {
    const a = document.createElement("a");
    a.href = result.url;
    const base = source?.name.replace(/\.[^.]+$/, "") ?? "image";
    a.download = `${base}_${result.level.label.replace(/\s+/g, "_").toLowerCase()}_q${Math.round(result.level.quality * 100)}.jpg`;
    a.click();
    toast.success(`Downloaded: ${result.level.label}`);
  };

  const bestResult = results.length
    ? results.reduce((a, b) => (a.size < b.size ? a : b))
    : null;

  // Shipping calculator derived values
  const platformResults = isValidWeight
    ? PLATFORMS.map((p) => ({
        ...p,
        charge: getChargeForWeight(p.rates, weightGrams),
        slab: getSlabLabel(weightGrams),
      }))
    : [];

  const cheapestCharge = platformResults.length
    ? Math.min(...platformResults.map((p) => p.charge))
    : null;

  return (
    <div className="min-h-screen bg-background font-sans">
      <Toaster position="top-right" />

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">
              ShipSaver
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a
              href="#calculator"
              data-ocid="nav.link"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
            >
              Calculator
            </a>
            <a
              href="#upload"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Compress
            </a>
          </nav>
          <Button
            data-ocid="nav.primary_button"
            className="bg-navy hover:bg-navy-dark text-white text-sm"
            onClick={() =>
              document
                .getElementById("upload")
                ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            Start Compressing
          </Button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="pt-20 pb-16 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-4 bg-orange-accent/10 text-orange-accent border-orange-accent/20 hover:bg-orange-accent/15">
            <Zap className="w-3 h-3 mr-1" /> Shipping Charge Bachao • Save
            Shipping Costs
          </Badge>
          <h1 className="text-5xl md:text-6xl font-extrabold text-foreground leading-tight mb-4">
            Product Image
            <span className="block text-blue-accent">Compressor</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-2">
            E-commerce sellers: compress product images to{" "}
            <strong className="text-foreground">reduce shipping charges</strong>{" "}
            — plus a{" "}
            <strong className="text-foreground">
              real weight-based calculator
            </strong>{" "}
            for Meesho, Flipkart & more.
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
            Image compress करें + असली shipping charge calculator — Meesho,
            Flipkart, Amazon सभी के लिए।
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              data-ocid="hero.primary_button"
              size="lg"
              className="bg-navy hover:bg-navy-dark text-white font-semibold px-8"
              onClick={() =>
                document
                  .getElementById("calculator")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <Calculator className="mr-2 w-4 h-4" />
              Shipping Calculator
            </Button>
            <Button
              data-ocid="hero.secondary_button"
              size="lg"
              variant="outline"
              className="border-navy text-navy hover:bg-navy hover:text-white font-semibold px-8"
              onClick={() =>
                document
                  .getElementById("upload")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Image Upload करें
              <ChevronDown className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        id="how-it-works"
        className="py-12 px-4 bg-card border-y border-border"
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-foreground mb-8">
            3 Simple Steps • 3 आसान कदम
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                icon: <Upload className="w-5 h-5" />,
                title: "Image Upload करें",
                desc: "Drag & drop, click to browse, or paste (Ctrl+V)",
              },
              {
                step: "2",
                icon: <Zap className="w-5 h-5" />,
                title: "Auto Compress",
                desc: "5 different quality levels automatically generated",
              },
              {
                step: "3",
                icon: <Download className="w-5 h-5" />,
                title: "Download & Save",
                desc: "Pick the best size and download. Shipping charge कम होगा!",
              },
            ].map((s) => (
              <div
                key={s.step}
                className="flex flex-col items-center text-center gap-3"
              >
                <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center text-navy">
                  {s.icon}
                </div>
                <div>
                  <div className="font-bold text-foreground">{s.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SHIPPING CALCULATOR ── */}
      <section id="calculator" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="text-center mb-8">
              <Badge className="mb-3 bg-green-100 text-green-800 border-green-200">
                <Calculator className="w-3 h-3 mr-1" /> Real Rates • असली चार्ज
              </Badge>
              <h2 className="text-3xl font-extrabold text-foreground mb-2">
                Shipping Charge Calculator • असली शिपिंग चार्ज
              </h2>
              <p className="text-muted-foreground">
                Apna product weight enter karo — real platform rates dikhayenge
              </p>
            </div>

            <Card className="shadow-card mb-6">
              <CardContent className="p-6">
                <div className="max-w-sm mx-auto">
                  <Label
                    htmlFor="weight-input"
                    className="text-sm font-semibold text-foreground mb-2 block"
                  >
                    Product Weight (grams)
                  </Label>
                  <Input
                    id="weight-input"
                    data-ocid="calculator.input"
                    type="number"
                    min="1"
                    max="5000"
                    placeholder="e.g. 350"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="text-lg h-12 text-center font-semibold"
                  />
                  {weightInput && !isValidWeight && (
                    <p
                      className="text-xs text-destructive mt-1 text-center"
                      data-ocid="calculator.error_state"
                    >
                      1 se 5000 grams ke beech enter karo
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Platform result cards */}
            <AnimatePresence>
              {isValidWeight && platformResults.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    {platformResults.map((p, idx) => {
                      const isCheapest = p.charge === cheapestCharge;
                      return (
                        <motion.div
                          key={p.name}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.06 }}
                          data-ocid={`calculator.item.${idx + 1}`}
                        >
                          <Card
                            className={`shadow-card relative ${
                              isCheapest
                                ? "border-2 border-green-500"
                                : "border border-border"
                            }`}
                          >
                            {isCheapest && (
                              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                <Badge className="bg-green-500 text-white text-xs px-2 py-0.5 shadow">
                                  ✓ Sabse Sasta
                                </Badge>
                              </div>
                            )}
                            <CardContent className="p-4 text-center">
                              <p
                                className={`font-bold text-sm mb-2 ${p.color}`}
                              >
                                {p.name}
                              </p>
                              <p
                                className={`text-3xl font-extrabold mb-1 ${
                                  isCheapest
                                    ? "text-green-600"
                                    : "text-foreground"
                                }`}
                              >
                                ₹{p.charge}
                              </p>
                              <p className="text-xs text-muted-foreground mb-2">
                                {p.slab}
                              </p>
                              <p className="text-xs text-muted-foreground/70 italic">
                                Approximate • Actual may vary
                              </p>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Static rate table */}
            <Card className="shadow-card">
              <CardContent className="p-0 overflow-hidden rounded-xl">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="font-bold text-foreground text-sm">
                    All Platform Rates at a Glance • सभी rates एक जगह
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold text-foreground">
                          Platform
                        </TableHead>
                        <TableHead className="text-center font-bold text-foreground">
                          0–500g
                        </TableHead>
                        <TableHead className="text-center font-bold text-foreground">
                          501–1000g
                        </TableHead>
                        <TableHead className="text-center font-bold text-foreground">
                          1001–2000g
                        </TableHead>
                        <TableHead className="text-center font-bold text-foreground">
                          2001–5000g
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {PLATFORMS.map((p) => (
                        <TableRow key={p.name}>
                          <TableCell className={`font-bold ${p.color}`}>
                            {p.name}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            ₹{p.rates.s500}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            ₹{p.rates.s1000}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            ₹{p.rates.s2000}
                          </TableCell>
                          <TableCell className="text-center font-semibold">
                            ₹{p.rates.s5000}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-xs text-muted-foreground px-6 py-3 border-t border-border">
                  ⚠️ Ye rates approximate hain. Actual charges platform ki
                  current policy ke hisaab se alag ho sakti hai.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ── UPLOAD ZONE ── */}
      <section
        id="upload"
        className="py-16 px-4 bg-card border-t border-border"
      >
        <div className="max-w-2xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-foreground mb-2">
            Upload or Paste Product Image
          </h2>
          <p className="text-center text-sm text-muted-foreground mb-6">
            अपनी product image यहाँ upload करें • Supports JPG, PNG, WEBP • Max
            25MB
          </p>

          <label
            htmlFor="dropzone-file-input"
            data-ocid="upload.dropzone"
            className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer block
              ${
                isDragging
                  ? "border-blue-accent bg-blue-accent/5"
                  : "border-[oklch(0.72_0.04_255)] bg-background hover:border-blue-accent hover:bg-blue-accent/3"
              }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              id="dropzone-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              data-ocid="upload.input"
            />
            <div className="py-14 px-8 flex flex-col items-center gap-4 text-center">
              {isCompressing ? (
                <>
                  <Loader2 className="w-12 h-12 text-blue-accent animate-spin" />
                  <p className="font-semibold text-foreground">
                    Compressing... कृपया प्रतीक्षा करें
                  </p>
                  <p className="text-sm text-muted-foreground">
                    5 quality levels generating…
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-navy/8 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-navy" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-lg">
                      Drag & Drop or Click to Browse
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      या Ctrl+V से clipboard image paste करें
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Button
                      data-ocid="upload.upload_button"
                      variant="outline"
                      size="sm"
                      className="border-navy text-navy hover:bg-navy hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <Upload className="w-4 h-4 mr-2" /> Browse File
                    </Button>
                    <Button
                      data-ocid="upload.secondary_button"
                      variant="outline"
                      size="sm"
                      className="border-border text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.info("Press Ctrl+V anywhere to paste image");
                      }}
                    >
                      <Clipboard className="w-4 h-4 mr-2" /> Paste (Ctrl+V)
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    {["JPG", "PNG", "WEBP"].map((f) => (
                      <Badge key={f} variant="secondary" className="text-xs">
                        {f}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="text-xs">
                      Max 25MB
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </label>
        </div>
      </section>

      {/* ── RESULTS ── */}
      <AnimatePresence>
        {results.length > 0 && source && (
          <motion.div
            ref={resultsRef}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pb-16 px-4"
          >
            <div className="max-w-6xl mx-auto">
              <div className="rounded-3xl bg-results-panel p-6 md:p-8">
                {/* Source card */}
                <div className="flex justify-center mb-8">
                  <Card
                    className="shadow-card max-w-xs w-full"
                    data-ocid="results.panel"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ImageIcon className="w-4 h-4 text-blue-accent" />
                        <span className="text-sm font-bold text-foreground">
                          Source Image • मूल छवि
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto w-6 h-6"
                          data-ocid="results.close_button"
                          onClick={() => {
                            setSource(null);
                            setResults([]);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="rounded-lg overflow-hidden bg-muted mb-3 aspect-square">
                        <img
                          src={source.url}
                          alt="Source"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-medium">
                        {source.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {source.width} × {source.height}px
                      </p>
                      <div className="mt-2">
                        <span className="text-sm font-bold text-foreground">
                          {formatBytes(source.size)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Compression cards */}
                <h3 className="text-center text-lg font-bold text-foreground mb-4">
                  Compression Options • संपीड़न विकल्प
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
                  {results.map((r, idx) => (
                    <motion.div
                      key={r.level.label}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.07 }}
                    >
                      <Card
                        className="shadow-card hover:shadow-lg transition-shadow"
                        data-ocid={`results.item.${idx + 1}`}
                      >
                        <CardContent className="p-4">
                          <div className="rounded-lg overflow-hidden bg-muted mb-3 aspect-square">
                            <img
                              src={r.url}
                              alt={r.level.label}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="mb-1">
                            <p className="text-xs font-bold text-foreground">
                              {r.level.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {r.level.labelHindi}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold text-foreground">
                              {formatBytes(r.size)}
                            </span>
                            <Badge className={`text-xs ${r.level.color}`}>
                              -{r.percent}%
                            </Badge>
                          </div>
                          <Button
                            data-ocid={`results.delete_button.${idx + 1}`}
                            size="sm"
                            className="w-full bg-navy hover:bg-navy-dark text-white text-xs"
                            onClick={() => handleDownload(r)}
                          >
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Impact strip */}
                {bestResult && (
                  <Card className="shadow-card" data-ocid="results.card">
                    <CardContent className="p-6">
                      <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-orange-accent" />
                        Size Comparison • आकार तुलना
                      </h3>
                      <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="text-center p-3 rounded-xl bg-muted">
                          <p className="text-xs text-muted-foreground mb-1">
                            Original Size
                          </p>
                          <p className="text-xl font-bold text-foreground">
                            {formatBytes(source.size)}
                          </p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-green-50 border border-green-200">
                          <p className="text-xs text-muted-foreground mb-1">
                            Best Compressed
                          </p>
                          <p className="text-xl font-bold text-green-700">
                            {formatBytes(bestResult.size)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-semibold text-foreground mb-3">
                          Size Comparison
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-28 shrink-0">
                              Original
                            </span>
                            <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full bg-destructive/70 rounded-full w-full" />
                            </div>
                            <span className="text-xs font-bold text-foreground w-16 text-right">
                              {formatBytes(source.size)}
                            </span>
                          </div>
                          {results.map((r) => (
                            <div
                              key={r.level.label}
                              className="flex items-center gap-3"
                            >
                              <span className="text-xs text-muted-foreground w-28 shrink-0">
                                {r.level.label}
                              </span>
                              <div className="flex-1 h-5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-blue-accent/70 rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(4, (r.size / source.size) * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold text-foreground w-16 text-right">
                                {formatBytes(r.size)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FEATURES ── */}
      <section
        id="features"
        className="py-16 px-4 bg-card border-t border-border"
      >
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-foreground mb-10">
            Why ShipSaver?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <TrendingDown className="w-6 h-6" />,
                title: "Real Shipping Calculator",
                desc: "Actual weight-based rates for Meesho, Flipkart, Amazon & Shiprocket — no fake numbers.",
              },
              {
                icon: <Zap className="w-6 h-6" />,
                title: "5 Quality Levels",
                desc: "High Quality (90%) से Thumbnail (15%) तक — आपकी जरूरत के अनुसार चुनें।",
              },
              {
                icon: <Package className="w-6 h-6" />,
                title: "Works Everywhere",
                desc: "Meesho, Flipkart, Amazon, Myntra — सभी platforms के लिए।",
              },
            ].map((f) => (
              <Card key={f.title} className="shadow-card">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-xl bg-navy/10 flex items-center justify-center text-navy mb-4">
                    {f.icon}
                  </div>
                  <h3 className="font-bold text-foreground mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-foreground text-background py-10 px-4 mt-0">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white">ShipSaver</span>
              </div>
              <p className="text-sm text-white/60">
                E-commerce sellers के लिए free image compression + shipping
                calculator tool।
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Links</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <a
                    href="#features"
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#calculator"
                    className="hover:text-white transition-colors"
                  >
                    Shipping Calculator
                  </a>
                </li>
                <li>
                  <a
                    href="#upload"
                    className="hover:text-white transition-colors"
                  >
                    Compress Now
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li>
                  <span className="hover:text-white transition-colors cursor-pointer">
                    Privacy Policy
                  </span>
                </li>
                <li>
                  <span className="hover:text-white transition-colors cursor-pointer">
                    Terms of Service
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-6 text-center">
            <p className="text-sm text-white/50">
              © {new Date().getFullYear()} ShipSaver. Built with ❤️ using{" "}
              <a
                href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/70 hover:text-white transition-colors underline"
              >
                caffeine.ai
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
