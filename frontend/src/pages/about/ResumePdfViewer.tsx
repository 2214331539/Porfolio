import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Minus, Plus } from 'lucide-react';
import {
  getDocument,
  GlobalWorkerOptions,
  TextLayer,
  type PDFDocumentProxy,
  type RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// ?v=2:2026-08-25 修复 nginx MIME(worker 此前以 octet-stream 返回)后,强制浏览器
// 绕过 immutable 缓存重新拉取 worker。worker 文件名是内容哈希,不随服务端配置变化。
GlobalWorkerOptions.workerSrc = `${pdfWorkerUrl}?v=2`;
const PDFJS_ASSET_BASE = new URL(`${import.meta.env.BASE_URL}pdfjs/`, document.baseURI).href;

type ResumePdfViewerProps = {
  documentUrl?: string | null;
  fallbackImageUrl: string;
  title: string;
  variant: 'preview' | 'reader';
  eager?: boolean;
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.75;
const ZOOM_STEP = 0.25;

function ResumeImageFallback({ imageUrl, title, eager = false }: { imageUrl: string; title: string; eager?: boolean }) {
  return (
    <img
      className="resume-pdf-fallback-image"
      src={imageUrl}
      alt={`${title}简历`}
      width={794}
      height={1123}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : 'auto'}
    />
  );
}

export default function ResumePdfViewer({ documentUrl, fallbackImageUrl, title, variant, eager = false }: ResumePdfViewerProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pageElementRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerElementRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const textLayerRef = useRef<TextLayer | null>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loadState, setLoadState] = useState<LoadState>(documentUrl ? 'loading' : 'idle');
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    setPageNumber(1);
    setPageCount(0);
    setZoom(1);
    setPdfDocument(null);

    if (!documentUrl) {
      setLoadState('idle');
      return undefined;
    }

    let active = true;
    const loadingTask = getDocument({
      url: documentUrl,
      cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
      wasmUrl: `${PDFJS_ASSET_BASE}wasm/`,
    });
    setLoadState('loading');

    loadingTask.promise
      .then((nextDocument) => {
        if (!active) {
          void loadingTask.destroy();
          return;
        }
        setPdfDocument(nextDocument);
        setPageCount(nextDocument.numPages);
        setLoadState('ready');
      })
      .catch(() => {
        if (active) setLoadState('error');
      });

    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      textLayerRef.current?.cancel();
      void loadingTask.destroy();
    };
  }, [documentUrl]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;

    const updateWidth = () => setStageWidth(Math.max(0, Math.floor(stage.clientWidth)));
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pdfDocument || !stageWidth || !canvasRef.current) return undefined;

    let active = true;
    const loadedDocument = pdfDocument;
    const canvas = canvasRef.current;
    const textLayerElement = textLayerElementRef.current;

    async function renderPage() {
      setRendering(true);
      renderTaskRef.current?.cancel();
      textLayerRef.current?.cancel();

      try {
        const page = await loadedDocument.getPage(pageNumber);
        if (!active) return;

        const naturalViewport = page.getViewport({ scale: 1 });
        const cssScale = (stageWidth / naturalViewport.width) * (variant === 'reader' ? zoom : 1);
        const outputScale = Math.min(window.devicePixelRatio || 1, 2.5);
        const cssViewport = page.getViewport({ scale: cssScale });
        const renderViewport = page.getViewport({ scale: cssScale * outputScale });
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas is unavailable');

        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;
        if (pageElementRef.current) {
          pageElementRef.current.style.width = `${Math.floor(cssViewport.width)}px`;
          pageElementRef.current.style.height = `${Math.floor(cssViewport.height)}px`;
        }

        const renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport: renderViewport,
          background: '#ffffff',
        });
        renderTaskRef.current = renderTask;
        await renderTask.promise;

        if (variant === 'reader' && textLayerElement && active) {
          textLayerElement.replaceChildren();
          textLayerElement.style.width = `${Math.floor(cssViewport.width)}px`;
          textLayerElement.style.height = `${Math.floor(cssViewport.height)}px`;
          const textLayer = new TextLayer({
            textContentSource: page.streamTextContent({ includeMarkedContent: true }),
            container: textLayerElement,
            viewport: cssViewport,
          });
          textLayerRef.current = textLayer;
          await textLayer.render();
        }

        if (active) setRendering(false);
      } catch (error) {
        if (!active || (error instanceof Error && error.name === 'RenderingCancelledException')) return;
        setRendering(false);
        setLoadState('error');
      }
    }

    void renderPage();
    return () => {
      active = false;
      renderTaskRef.current?.cancel();
      textLayerRef.current?.cancel();
    };
  }, [pageNumber, pdfDocument, stageWidth, variant, zoom]);

  const hasPdf = Boolean(documentUrl && loadState !== 'error');
  const zoomOut = () => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));
  const zoomIn = () => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));

  return (
    <div className={`resume-pdf-viewer ${variant}`}>
      {variant === 'reader' && hasPdf ? (
        <nav className="resume-pdf-controls" aria-label="PDF 阅读控制">
          <div className="resume-pdf-control-group">
            <button type="button" onClick={() => setPageNumber((value) => Math.max(1, value - 1))} disabled={pageNumber <= 1} aria-label="上一页"><ArrowLeft aria-hidden="true" /></button>
            <span aria-live="polite">{pageNumber} / {Math.max(pageCount, 1)}</span>
            <button type="button" onClick={() => setPageNumber((value) => Math.min(pageCount, value + 1))} disabled={!pageCount || pageNumber >= pageCount} aria-label="下一页"><ArrowRight aria-hidden="true" /></button>
          </div>
          <span className="resume-pdf-keyboard-hint">Ctrl / ⌘ + F 搜索 · 可拖选文字</span>
          <div className="resume-pdf-control-group">
            <button type="button" onClick={zoomOut} disabled={zoom <= MIN_ZOOM} aria-label="缩小"><Minus aria-hidden="true" /></button>
            <button className="resume-pdf-fit-button" type="button" onClick={() => setZoom(1)} aria-label="恢复适合宽度">适宽 · {Math.round(zoom * 100)}%</button>
            <button type="button" onClick={zoomIn} disabled={zoom >= MAX_ZOOM} aria-label="放大"><Plus aria-hidden="true" /></button>
          </div>
        </nav>
      ) : null}

      <div ref={stageRef} className="resume-pdf-canvas-stage">
        {pdfDocument && loadState === 'ready' ? (
          <div ref={pageElementRef} className="resume-pdf-page">
            <canvas ref={canvasRef} aria-label={`${title} PDF 第 ${pageNumber} 页`} role={variant === 'preview' ? 'img' : undefined} aria-hidden={variant === 'reader' ? 'true' : undefined} />
            {variant === 'reader' ? <div ref={textLayerElementRef} className="resume-pdf-text-layer textLayer" /> : null}
          </div>
        ) : (
          <ResumeImageFallback imageUrl={fallbackImageUrl} title={title} eager={eager} />
        )}

        {loadState === 'loading' ? <span className="resume-pdf-status" role="status" aria-live="polite">正在生成高清预览…</span> : null}
        {rendering && loadState === 'ready' ? <span className="resume-pdf-status" role="status" aria-live="polite">正在优化清晰度…</span> : null}
        {loadState === 'error' ? <span className="resume-pdf-status fallback" role="status">高清预览暂不可用，已显示图片版本</span> : null}
      </div>
    </div>
  );
}
