export interface WindowOptions {
  id: string;
  title: string;
  x: number;
  y: number;
  width?: number;
  contentHtml: string;
  onClose?: () => void;
}

export class WindowManager {
  private layer: HTMLElement;
  private windows: Map<string, HTMLElement> = new Map();
  private onCloses: Map<string, () => void> = new Map();
  private zIndexCounter: number = 10;

  constructor(layerId: string) {
    this.layer = document.getElementById(layerId) as HTMLElement;
  }

  public hasWindow(id: string): boolean {
    return this.windows.has(id);
  }

  public createWindow(opts: WindowOptions) {
    if (this.windows.has(opts.id)) {
      this.focusWindow(opts.id);
      return;
    }

    if (opts.onClose) {
      this.onCloses.set(opts.id, opts.onClose);
    }

    const win = document.createElement('div');
    win.className = 'os-window';
    win.id = `win-${opts.id}`;
    win.style.left = `${opts.x}px`;
    win.style.top = `${opts.y}px`;
    if (opts.width) win.style.width = `${opts.width}px`;
    win.style.zIndex = (this.zIndexCounter++).toString();

    const header = document.createElement('div');
    header.className = 'os-window-header';
    
    const title = document.createElement('span');
    title.innerText = opts.title;
    
    const closeBtn = document.createElement('div');
    closeBtn.innerText = 'X';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.background = '#c0c0c0';
    closeBtn.style.color = '#000';
    closeBtn.style.padding = '0 4px';
    closeBtn.style.border = '1px solid #fff';
    closeBtn.style.borderRightColor = '#000';
    closeBtn.style.borderBottomColor = '#000';
    closeBtn.onclick = () => {
      this.closeWindow(opts.id);
    };

    header.appendChild(title);
    header.appendChild(closeBtn);

    const content = document.createElement('div');
    content.className = 'os-window-content';
    content.innerHTML = opts.contentHtml;

    win.appendChild(header);
    win.appendChild(content);

    this.makeDraggable(win, header);

    win.onmousedown = () => this.focusWindow(opts.id);

    this.layer.appendChild(win);
    this.windows.set(opts.id, win);
  }

  public updateWindowContent(id: string, html: string) {
    const win = this.windows.get(id);
    if (win) {
      const content = win.querySelector('.os-window-content') as HTMLElement;
      if (content) content.innerHTML = html;
    }
  }

  public closeWindow(id: string) {
    const win = this.windows.get(id);
    if (win) {
      win.remove();
      this.windows.delete(id);
      if (this.onCloses.has(id)) {
        this.onCloses.get(id)!();
        this.onCloses.delete(id);
      }
    }
  }

  public getWindowsState(): Array<{id: string, x: number, y: number}> {
    const state: Array<{id: string, x: number, y: number}> = [];
    this.windows.forEach((win, id) => {
      // Ignore pause menu and settings from being saved
      if (id !== 'pause-menu' && id !== 'settings' && id !== 'audio-settings' && !id.startsWith('dialog-')) {
        state.push({
          id,
          x: parseInt(win.style.left || '0', 10),
          y: parseInt(win.style.top || '0', 10)
        });
      }
    });
    return state;
  }

  public setWindowPosition(id: string, x: number, y: number) {
    const win = this.windows.get(id);
    if (win) {
      win.style.left = `${x}px`;
      win.style.top = `${y}px`;
    }
  }

  private focusWindow(id: string) {
    const win = this.windows.get(id);
    if (win) {
      win.style.zIndex = (this.zIndexCounter++).toString();
      // Update header colors to show active state
      this.windows.forEach(w => {
        const header = w.querySelector('.os-window-header') as HTMLElement;
        if (header) header.style.background = 'var(--title-bg-inactive)';
      });
      const activeHeader = win.querySelector('.os-window-header') as HTMLElement;
      if (activeHeader) activeHeader.style.background = 'var(--title-bg-active)';
    }
  }

  private makeDraggable(win: HTMLElement, handle: HTMLElement) {
    let isDragging = false;
    let startX = 0, startY = 0, initialX = 0, initialY = 0;

    handle.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = parseInt(win.style.left || '0', 10);
      initialY = parseInt(win.style.top || '0', 10);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      win.style.left = `${initialX + dx}px`;
      win.style.top = `${initialY + dy}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }
}
