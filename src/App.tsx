import React, { useState, useEffect, useCallback } from 'react';
import { 
  Archive, 
  Copy, 
  Check, 
  Zap, 
  Info, 
  ArrowDownToLine,
  Trash2,
  Terminal,
  FileJson,
  AlertCircle,
  Layers,
  Sparkles,
  Loader2,
  Cpu
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import pako from 'pako';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  const [inputCode, setInputCode] = useState<string>(`// Example: Large repetitive code
function processData(data) {
  console.log("Processing item:", data.id);
  console.log("Status:", data.status);
  console.log("Timestamp:", new Date().toISOString());
  return { ...data, processed: true };
}

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, status: 'pending' }));
items.map(processData);`);
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [compressionMode, setCompressionMode] = useState<'standard' | 'streaming'>('standard');
  const [compressionFormat, setCompressionFormat] = useState<'deflate' | 'gzip'>('deflate');
  const [copied, setCopied] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const compressCode = useCallback(async (code: string, mode: 'standard' | 'streaming', format: 'deflate' | 'gzip') => {
    if (!code.trim()) {
      setResult(null);
      return;
    }

    try {
      let base64 = '';
      let decoderType = '';
      
      if (mode === 'standard') {
        // One-shot compression using pako
        const compressed = format === 'gzip' ? pako.gzip(code, { level: 9 }) : pako.deflate(code, { level: 9 });
        base64 = btoa(String.fromCharCode(...compressed));
        decoderType = `One-shot ${format.toUpperCase()}`;
      } else {
        // Streaming-ready protocol
        const stream = new Blob([code]).stream();
        const compressionStream = stream.pipeThrough(new CompressionStream(format));
        const reader = compressionStream.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const combined = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        
        base64 = btoa(String.fromCharCode(...combined));
        decoderType = `Streaming ${format.toUpperCase()} (Chunked)`;
      }

      const pyDecoder = format === 'gzip'
        ? `import gzip, base64
# Gzip Decoder
C = "${base64}"
exec(gzip.decompress(base64.b64decode(C)).decode('utf-8'))`
        : (mode === 'standard' 
          ? `import zlib, base64
# One-shot Deflate Decoder
C = "${base64}"
exec(zlib.decompress(base64.b64decode(C)).decode('utf-8'))`
          : `import zlib, base64, io
# Streaming-ready Deflate Decoder (Chunked)
C = "${base64}"
def stream_decode(data):
    d = zlib.decompressobj()
    yield d.decompress(base64.b64decode(data))
    yield d.flush()

# Execute full stream
exec("".join(stream_decode(C)))`);

      const inputSize = code.length;
      const outputSize = pyDecoder.length;
      const netSavings = inputSize - outputSize;
      const ratio = (outputSize / inputSize) * 100;

      setResult({
        base64,
        pyDecoder,
        inputSize,
        outputSize,
        netSavings,
        ratio: ratio.toFixed(1),
        decoderType
      });
    } catch (err) {
      console.error("Compression failed:", err);
    }
  }, []);

  useEffect(() => {
    compressCode(inputCode, compressionMode, compressionFormat);
  }, [inputCode, compressionMode, compressionFormat, compressCode]);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{
          parts: [{
            text: `Optimize this code for maximum compression. 
            1. Remove all comments.
            2. Minify variable names if they are long and repetitive.
            3. Remove unnecessary whitespace.
            Return ONLY the optimized code. No markdown formatting.
            
            Code:
            ${inputCode}`
          }]
        }]
      });

      const text = response.text;
      if (text) {
        setInputCode(text.replace(/```[a-z]*\n?|```/g, '').trim());
      }
    } catch (error) {
      console.error("AI Optimization failed:", error);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-400 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-600/40">
              <Archive className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">TokenZip <span className="text-indigo-500">Pro</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setCompressionFormat('deflate')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${compressionFormat === 'deflate' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Deflate
              </button>
              <button 
                onClick={() => setCompressionFormat('gzip')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${compressionFormat === 'gzip' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Gzip
              </button>
            </div>
            <div className="flex bg-zinc-900/50 p-1 rounded-xl border border-white/5">
              <button 
                onClick={() => setCompressionMode('standard')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${compressionMode === 'standard' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Standard
              </button>
              <button 
                onClick={() => setCompressionMode('streaming')}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${compressionMode === 'streaming' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                Streaming
              </button>
            </div>
            <button 
              onClick={() => setInputCode('')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-600 hover:text-red-400"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid lg:grid-cols-12 gap-10">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2 text-zinc-500">
                <Terminal size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Source Logic</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleOptimize}
                  disabled={isOptimizing}
                  className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-all text-[10px] font-bold uppercase tracking-tighter disabled:opacity-50"
                >
                  {isOptimizing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  AI Optimize
                </button>
                <span className="text-[10px] font-mono text-zinc-700">{inputCode.length} bytes</span>
              </div>
            </div>
            <div className="relative group">
              <textarea
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Paste code to compress..."
                className="w-full h-[500px] bg-zinc-900/20 border border-white/5 rounded-xl p-6 font-mono text-sm leading-relaxed focus:outline-none focus:border-indigo-500/40 transition-all resize-none shadow-2xl"
              />
              {isOptimizing && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-4">
                    <Cpu className="w-12 h-12 text-emerald-400 animate-pulse" />
                    <p className="text-emerald-400 font-mono text-xs uppercase tracking-widest">Gemini Optimizing...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Protocol Analysis */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-2xl">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Layers size={14} /> {compressionMode === 'streaming' ? 'Streaming Benefits' : 'Standard Benefits'}
                </h3>
                <ul className="text-xs space-y-2 text-zinc-400 list-disc pl-4">
                  {compressionMode === 'streaming' ? (
                    <>
                      <li>Low memory footprint for large files</li>
                      <li>Processes data in chunks as it arrives</li>
                      <li>Ideal for network-based code delivery</li>
                      <li>Scales to multi-megabyte inputs</li>
                    </>
                  ) : (
                    <>
                      <li>Simplest decoder implementation</li>
                      <li>Fastest for small to medium files</li>
                      <li>Minimal CPU overhead for decompression</li>
                      <li>Higher compatibility with legacy systems</li>
                    </>
                  )}
                </ul>
              </div>
              <div className="bg-zinc-900/40 border border-white/5 p-6 rounded-2xl">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertCircle size={14} /> Protocol Trade-offs
                </h3>
                <ul className="text-xs space-y-2 text-zinc-400 list-disc pl-4">
                  {compressionMode === 'streaming' ? (
                    <>
                      <li>More complex decoder logic (+50 bytes)</li>
                      <li>Slightly higher latency per chunk</li>
                      <li>Requires streaming-aware environment</li>
                    </>
                  ) : (
                    <>
                      <li>Memory spikes on very large inputs</li>
                      <li>Blocks execution until full load</li>
                      <li>Inefficient for real-time streams</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column: Output & Stats */}
          <div className="lg:col-span-5 space-y-8">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-8"
                >
                  {/* Performance Metrics */}
                  <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-2xl shadow-indigo-600/20 relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-2">Net Token Savings</p>
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-5xl font-bold tracking-tighter">
                          {result.netSavings > 0 ? `-${result.netSavings}` : `+${Math.abs(result.netSavings)}`}
                        </h2>
                        <span className="text-xl opacity-70 font-medium">tokens</span>
                      </div>
                      <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] uppercase font-bold opacity-60">Efficiency Ratio</p>
                          <p className="text-xl font-bold">{result.ratio}%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold opacity-60">Protocol</p>
                          <p className="text-xl font-bold uppercase tracking-tighter">
                            {compressionMode}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Zap className="absolute -bottom-4 -right-4 w-32 h-32 text-white/5 rotate-12" />
                  </div>

                  {/* Compressed Output */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2 text-zinc-500">
                        <FileJson size={16} />
                        <span className="text-xs font-bold uppercase tracking-widest">{result.decoderType}</span>
                      </div>
                      <button 
                        onClick={() => handleCopy(result.pyDecoder, 'py')}
                        className="p-2 hover:bg-indigo-500/10 rounded-lg transition-colors text-indigo-400"
                      >
                        {copied === 'py' ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                    <div className="bg-black border border-white/5 rounded-2xl p-6 font-mono text-xs leading-relaxed text-indigo-300/80 break-all max-h-[300px] overflow-y-auto">
                      {result.pyDecoder}
                    </div>
                  </div>

                  {/* Expenditure Breakdown */}
                  <div className="bg-zinc-900/20 border border-white/5 rounded-2xl p-6 space-y-4">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Expenditure Report</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-600">Base64 Encoding</span>
                        <span className="text-zinc-400">Fixed 33% overhead</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-600">Decoder Logic</span>
                        <span className="text-zinc-400">{compressionMode === 'streaming' ? '~170 bytes' : '~120 bytes'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-zinc-600">AI Optimization</span>
                        <span className="text-emerald-500 font-bold">Variable Savings</span>
                      </div>
                      <div className="flex justify-between text-xs pt-3 border-t border-white/5">
                        <span className="text-zinc-500 font-bold">Total Payload</span>
                        <span className="text-indigo-400 font-bold">
                          {result.outputSize} bytes
                        </span>
                      </div>
                    </div>
                  </div>

                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-4 border-2 border-dashed border-white/5 rounded-3xl p-12">
                  <ArrowDownToLine size={40} className="opacity-20" />
                  <p className="text-sm font-medium">Awaiting input for analysis...</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-white/5 mt-12 flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600">
        <span>TokenZip Pro Protocol v3.0</span>
        <div className="flex gap-8">
          <a href="#" className="hover:text-indigo-400 transition-colors">AI Insights</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">Streaming API</a>
        </div>
      </footer>
    </div>
  );
}
