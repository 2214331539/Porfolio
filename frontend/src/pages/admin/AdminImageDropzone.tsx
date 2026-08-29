import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { ImagePlus, Upload } from 'lucide-react';

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type AdminImageDropzoneProps = {
  title: string;
  hint: string;
  buttonLabel: string;
  uploading: boolean;
  multiple?: boolean;
  className?: string;
  onFiles: (files: File[]) => void | Promise<void>;
  onInvalid: (message: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  children?: ReactNode;
};

export function AdminImageDropzone({
  title,
  hint,
  buttonLabel,
  uploading,
  multiple = false,
  className = '',
  onFiles,
  onInvalid,
  onClear,
  clearLabel = '移除',
  children,
}: AdminImageDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  function chooseFiles(fileList: FileList | File[]) {
    if (uploading) return;
    const files = Array.from(fileList);
    if (!files.length) return;
    if (!multiple && files.length > 1) {
      onInvalid('文章封面每次只能上传一张图片');
      return;
    }

    const accepted = files.filter((file) => ACCEPTED_IMAGE_TYPES.has(file.type));
    const rejectedCount = files.length - accepted.length;
    if (rejectedCount) {
      onInvalid(`${rejectedCount} 个文件格式不受支持，请使用 JPG、PNG 或 WebP`);
    }
    if (!accepted.length) return;
    void onFiles(multiple ? accepted : accepted.slice(0, 1));
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (uploading || !event.dataTransfer.types.includes('Files')) return;
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = uploading ? 'none' : 'copy';
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    chooseFiles(event.dataTransfer.files);
  }

  return (
    <section
      className={`admin-image-dropzone ${dragging ? 'is-dragging' : ''} ${uploading ? 'is-uploading' : ''} ${className}`.trim()}
      aria-label={`${title}上传区域`}
      aria-busy={uploading}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="admin-image-dropzone-heading">
        <span className="admin-image-dropzone-icon"><ImagePlus aria-hidden="true" /></span>
        <div>
          <strong>{dragging ? '松开鼠标，立即上传' : title}</strong>
          <small>{dragging ? multiple ? '已识别图片，可一次上传多张' : '已识别图片，将作为文章封面' : hint}</small>
        </div>
        {onClear ? <button className="admin-image-dropzone-clear" type="button" onClick={onClear}>{clearLabel}</button> : null}
      </div>

      {children}

      <div className="admin-image-dropzone-actions">
        <label className="cover-file-input admin-image-dropzone-picker">
          <Upload aria-hidden="true" />
          <span>{uploading ? '正在上传…' : buttonLabel}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={multiple}
            onChange={(event) => {
              const input = event.currentTarget;
              if (input.files) chooseFiles(input.files);
              input.value = '';
            }}
            disabled={uploading}
          />
        </label>
        <span>{multiple ? '或将多张图片拖入这里' : '或将图片拖入这里'}</span>
      </div>
    </section>
  );
}
