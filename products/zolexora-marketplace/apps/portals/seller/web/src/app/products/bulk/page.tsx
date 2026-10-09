"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { productsApi } from "@/lib/api";
import {
  Upload, Trash2, AlertCircle, ArrowLeft,
  FileSpreadsheet, CheckCircle, Loader2, Download, Plus,
} from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

const CATEGORIES = ["Electronics","Fashion","Home & Living","Beauty","Sports","Food","Other"];

const SAMPLE_CSV = `Title,Description,Category,Price,Original Price,Stock,Image URLs
Wireless Headphones,Premium ANC headphones with 40hr battery,Electronics,4999,7999,50,
Running Shoes,Carbon fibre sole trail runners,Sports,3499,5499,30,
Organic Face Serum,Natural vitamin C brightening serum,Beauty,899,1299,100,`;

interface Row {
  id:             number;
  title:          string;
  description:    string;
  category:       string;
  price:          string;
  original_price: string;
  stock:          string;
  images:         string;
  errors:         string[];
}

function validateRow(row: Row): string[] {
  const errs: string[] = [];
  if (!row.title.trim())                                          errs.push("Title required");
  if (!row.description.trim())                                    errs.push("Description required");
  if (!row.price||isNaN(Number(row.price))||Number(row.price)<=0) errs.push("Valid price required");
  if (!CATEGORIES.includes(row.category))                         errs.push("Invalid category");
  if (row.stock && isNaN(Number(row.stock)))                      errs.push("Stock must be a number");
  if (row.original_price && isNaN(Number(row.original_price)))    errs.push("Original price must be a number");
  return errs;
}

function parseCSV(text: string): Row[] {
  const lines  = text.trim().split("\n").filter(Boolean);
  const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/ /g,"_"));
  return lines.slice(1).map((line, i) => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g,""));
    const get  = (key: string) => vals[header.indexOf(key)] || "";
    const row: Row = {
      id: i, title: get("title"), description: get("description"),
      category: get("category") || "Other", price: get("price"),
      original_price: get("original_price"), stock: get("stock") || "999",
      images: get("image_urls"), errors: [],
    };
    row.errors = validateRow(row);
    return row;
  });
}

function parseJSON(text: string): Row[] {
  const arr = JSON.parse(text);
  return arr.map((item: any, i: number) => {
    const row: Row = {
      id: i, title: item.title||"", description: item.description||"",
      category: item.category||"Other", price: String(item.price||""),
      original_price: String(item.original_price||""), stock: String(item.stock||"999"),
      images: Array.isArray(item.images) ? item.images.join(",") : (item.images||""),
      errors: [],
    };
    row.errors = validateRow(row);
    return row;
  });
}

export default function BulkUploadPage() {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);
  const [rows,     setRows]     = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);
  const [imported, setImported] = useState(0);

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      try {
        const parsed = file.name.endsWith(".json") ? parseJSON(text) : parseCSV(text);
        setRows(parsed);
        if (parsed.length === 0) toast.error("No rows found in file");
        else toast.success(`${parsed.length} rows loaded`);
      } catch { toast.error("Failed to parse file. Check format."); }
    };
    reader.readAsText(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, []);

  const updateRow = (id: number, field: keyof Row, value: string) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      updated.errors = validateRow(updated);
      return updated;
    }));
  };

  const removeRow  = (id: number) => setRows(prev => prev.filter(r => r.id !== id));
  const addRow     = () => {
    const newRow: Row = {
      id: Date.now(), title:"", description:"", category:"Other",
      price:"", original_price:"", stock:"999", images:"",
      errors:["Title required","Description required","Valid price required"],
    };
    setRows(prev => [...prev, newRow]);
  };

  const validRows   = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length  > 0);

  const handleUpload = async () => {
    if (validRows.length === 0) { toast.error("No valid rows to upload"); return; }
    if (invalidRows.length > 0) {
      const ok = confirm(`${invalidRows.length} rows have errors and will be skipped. Upload ${validRows.length} valid rows?`);
      if (!ok) return;
    }
    setBusy(true);
    try {
      const payload = validRows.map(r => ({
        title:          r.title.trim(),
        description:    r.description.trim(),
        category:       r.category,
        price:          parseFloat(r.price),
        original_price: r.original_price ? parseFloat(r.original_price) : undefined,
        stock:          parseInt(r.stock) || 999,
        images:         r.images ? r.images.split(",").map(s=>s.trim()).filter(Boolean) : [],
      }));
      const res = await productsApi.bulkCreate(payload);
      setImported(res.imported);
      setDone(true);
      toast.success(`${res.imported} products created!`);
      setTimeout(() => router.push("/products"), 2000);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || "Upload failed");
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type:"text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "zolexora_bulk_template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const ic = "h-8 px-2 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:border-gold focus:bg-white w-full transition-all";

  if (done) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
        <CheckCircle size={40} className="text-green-500"/>
      </div>
      <h2 className="font-display text-2xl font-bold text-ink">{imported} Products Created!</h2>
      <p className="text-gray-500 text-sm">Redirecting to products list...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/products" className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center hover:border-gold transition-colors">
            <ArrowLeft size={16} className="text-gray-500"/>
          </Link>
          <div>
            <h1 className="font-display text-xl font-bold text-ink">Bulk Product Upload</h1>
            <p className="text-xs text-gray-400 mt-0.5">Upload CSV or JSON · Max 500 products</p>
          </div>
        </div>
        <button onClick={downloadTemplate}
          className="h-9 px-4 rounded-xl border border-gray-200 hover:border-gold flex items-center gap-2 text-xs font-semibold text-gray-600 transition-all">
          <Download size={14}/> Download Template
        </button>
      </div>

      {rows.length === 0 && (
        <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)}
          onDrop={onDrop} onClick={()=>fileRef.current?.click()}
          className={"border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all mb-6 "+(dragging?"border-gold bg-amber-50":"border-gray-200 bg-gray-50 hover:border-gold hover:bg-amber-50/30")}>
          <FileSpreadsheet size={40} className="text-gray-300 mx-auto mb-4"/>
          <p className="font-bold text-ink mb-1">Drop your CSV or JSON file here</p>
          <p className="text-sm text-gray-400 mb-4">or click to browse</p>
          <div className="inline-flex items-center gap-2 h-9 px-5 bg-gold rounded-xl text-sm font-bold text-ink">
            <Upload size={14}/> Choose File
          </div>
          <p className="text-xs text-gray-400 mt-4">Supports: .csv · .json · Max 500 rows</p>
          <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={onFileChange}/>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-xs font-semibold">
            <CheckCircle size={13}/> {validRows.length} valid
          </div>
          {invalidRows.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold">
              <AlertCircle size={13}/> {invalidRows.length} with errors
            </div>
          )}
          <span className="text-xs text-gray-400">{rows.length} total rows</span>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={()=>fileRef.current?.click()} className="h-8 px-3 rounded-xl border border-gray-200 hover:border-gold text-xs font-semibold text-gray-600 transition-all">Replace File</button>
            <button onClick={addRow} className="h-8 px-3 rounded-xl border border-gray-200 hover:border-gold text-xs font-semibold text-gray-600 transition-all flex items-center gap-1"><Plus size={12}/> Add Row</button>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={onFileChange}/>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["#","Title *","Description *","Category *","Price ₹ *","Orig Price ₹","Stock","Image URLs","Status",""].map(h=>(
                    <th key={h} className="px-3 py-3 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, idx) => (
                  <tr key={row.id} className={row.errors.length > 0 ? "bg-red-50/30" : ""}>
                    <td className="px-3 py-2 text-gray-400">{idx+1}</td>
                    <td className="px-3 py-2 min-w-[160px]"><input value={row.title}          onChange={e=>updateRow(row.id,"title",e.target.value)}          className={ic}/></td>
                    <td className="px-3 py-2 min-w-[200px]"><input value={row.description}    onChange={e=>updateRow(row.id,"description",e.target.value)}    className={ic}/></td>
                    <td className="px-3 py-2 min-w-[130px]">
                      <select value={row.category} onChange={e=>updateRow(row.id,"category",e.target.value)} className={ic}>
                        {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 w-24"><input type="number" value={row.price}          onChange={e=>updateRow(row.id,"price",e.target.value)}          className={ic} placeholder="0"/></td>
                    <td className="px-3 py-2 w-28"><input type="number" value={row.original_price} onChange={e=>updateRow(row.id,"original_price",e.target.value)} className={ic} placeholder="0"/></td>
                    <td className="px-3 py-2 w-20"><input type="number" value={row.stock}          onChange={e=>updateRow(row.id,"stock",e.target.value)}          className={ic} placeholder="999"/></td>
                    <td className="px-3 py-2 min-w-[160px]"><input value={row.images}             onChange={e=>updateRow(row.id,"images",e.target.value)}         className={ic} placeholder="url1,url2"/></td>
                    <td className="px-3 py-2">
                      {row.errors.length === 0 ? <CheckCircle size={14} className="text-green-500"/> : (
                        <div className="group relative">
                          <AlertCircle size={14} className="text-red-500 cursor-help"/>
                          <div className="hidden group-hover:block absolute right-0 top-5 z-10 bg-white border border-red-100 rounded-xl shadow-lg p-2 min-w-[160px]">
                            {row.errors.map(e=><p key={e} className="text-xs text-red-600 py-0.5">{e}</p>)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={()=>removeRow(row.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {invalidRows.length > 0 && `${invalidRows.length} rows with errors will be skipped. `}
            {validRows.length} rows will be uploaded.
          </p>
          <button onClick={handleUpload} disabled={busy || validRows.length === 0}
            className="h-12 px-8 bg-gold hover:bg-amber-400 rounded-xl font-bold text-sm text-ink transition-all disabled:opacity-50 flex items-center gap-2">
            {busy ? <><Loader2 size={16} className="animate-spin"/> Uploading...</> : <><Upload size={16}/> Upload {validRows.length} Products</>}
          </button>
        </div>
      )}
    </div>
  );
}
