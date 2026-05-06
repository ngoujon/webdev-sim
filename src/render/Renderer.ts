import { GameState } from '../sim/gameState';

type Renderable = {
  y: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private frameCount: number = 0;

  constructor(canvasId: string) {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  private resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width / 4; 
    this.canvas.height = this.height / 4;
    this.ctx.imageSmoothingEnabled = false;
  }

  private drawRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, outline: string = '#000') {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  private drawIsoBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, d: number, h: number, topColor: string, frontColor: string, sideColor?: string, drawShadow: boolean = true) {
    if (drawShadow) {
      // Shadow on the floor
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(x + 2, y - d + 2, w, d);
    }

    // Front face (draws from y - h up to y, depth adds nothing to front view y directly except base offset)
    this.drawRect(ctx, x, y - d - h, w, h, frontColor);
    
    // Top face
    this.drawRect(ctx, x, y - d - h - d, w, d, topColor); // Perspective trick: top face is displaced by depth

    // Side face (very simple pseudo-isometric right face if needed, currently unused to keep orthogonal view)
    if (sideColor) {
        this.drawRect(ctx, x + w, y - d - h - d, d, h + d, sideColor);
    }
  }

  private lerpColor(c1: number[], c2: number[], t: number): string {
    const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
    const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
    const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  private getWindowColor(): string {
    const t = GameState.timeOfDay;
    // Night: 10, 10, 42
    // Morning: 255, 179, 71
    // Day: 135, 206, 235
    // Evening: 253, 94, 83

    const night = [10, 10, 42];
    const morning = [255, 179, 71];
    const day = [135, 206, 235];
    const evening = [253, 94, 83];

    if (t < 5) return `rgb(10, 10, 42)`;
    if (t >= 5 && t < 8) {
      // Transition Night -> Morning (5h to 8h)
      const ratio = (t - 5) / 3;
      return this.lerpColor(night, morning, ratio);
    }
    if (t >= 8 && t < 10) {
      // Transition Morning -> Day (8h to 10h)
      const ratio = (t - 8) / 2;
      return this.lerpColor(morning, day, ratio);
    }
    if (t >= 10 && t < 17) return `rgb(135, 206, 235)`;
    if (t >= 17 && t < 19) {
      // Transition Day -> Evening (17h to 19h)
      const ratio = (t - 17) / 2;
      return this.lerpColor(day, evening, ratio);
    }
    if (t >= 19 && t < 21) {
      // Transition Evening -> Night (19h to 21h)
      const ratio = (t - 19) / 2;
      return this.lerpColor(evening, night, ratio);
    }
    return `rgb(10, 10, 42)`;
  }

  private drawSky(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Background
    const skyColor = this.getWindowColor();
    ctx.fillStyle = skyColor;
    ctx.fillRect(x, y, w, h);

    const time = GameState.timeOfDay;
    const day = GameState.day;
    const isDay = time >= 6 && time < 19;

    if (isDay) {
      // Sun
      const ratio = (time - 6) / 13;
      const sunX = x + ratio * w;
      const sunY = y + h - Math.sin(ratio * Math.PI) * (h - 2);
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(sunX, sunY, 6, 0, Math.PI*2); ctx.fill();
    } else {
      // Moon
      let ratio = 0;
      if (time >= 19) ratio = (time - 19) / 11;
      else ratio = (time + 5) / 11;
      
      const moonX = x + ratio * w;
      const moonY = y + h - Math.sin(ratio * Math.PI) * (h - 2);
      
      // Moon phases: 0=New, 14=Full, 28 days cycle
      const phase = day % 28;
      const r = 5;

      if (phase !== 0) {
        // Base moon (white)
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath(); ctx.arc(moonX, moonY, r, 0, Math.PI*2); ctx.fill();
        
        if (phase !== 14) {
          ctx.fillStyle = skyColor;
          
          if (phase < 14) {
            // Waxing: Light on the RIGHT, Dark on the LEFT.
            ctx.beginPath();
            ctx.rect(moonX - r - 1, moonY - r - 1, r + 1, r * 2 + 2);
            ctx.fill();

            const p = phase; // 1 to 13
            if (p < 7) {
              // Crescent: dark ellipse in the center
              const ellipseWidth = r * (1 - (p / 7));
              ctx.beginPath();
              ctx.ellipse(moonX, moonY, ellipseWidth, r, 0, 0, Math.PI * 2);
              ctx.fill();
            } else if (p > 7) {
              // Gibbous: light ellipse in the center
              const ellipseWidth = r * ((p - 7) / 7);
              ctx.fillStyle = '#ecf0f1';
              ctx.beginPath();
              ctx.ellipse(moonX, moonY, ellipseWidth, r, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else {
            // Waning: Light on the LEFT, Dark on the RIGHT.
            ctx.beginPath();
            ctx.rect(moonX, moonY - r - 1, r + 1, r * 2 + 2);
            ctx.fill();

            const p = phase - 14; // 1 to 13
            if (p < 7) {
              // Gibbous: light ellipse in the center
              const ellipseWidth = r * (1 - (p / 7));
              ctx.fillStyle = '#ecf0f1';
              ctx.beginPath();
              ctx.ellipse(moonX, moonY, ellipseWidth, r, 0, 0, Math.PI * 2);
              ctx.fill();
            } else if (p > 7) {
              // Crescent: dark ellipse in the center
              const ellipseWidth = r * ((p - 7) / 7);
              ctx.fillStyle = skyColor;
              ctx.beginPath();
              ctx.ellipse(moonX, moonY, ellipseWidth, r, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
      
      // Stars
      ctx.fillStyle = '#fff';
      const numStars = (Math.floor(x) + Math.floor(y)) % 10 + 5;
      for (let i = 0; i < numStars; i++) {
        const sx = x + ((i * 17) % w);
        const sy = y + ((i * 23) % (h / 2));
        ctx.fillRect(sx, sy, 1, 1);
      }
    }

    // Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let i = 0; i < 3; i++) {
      const cloudX = x + ((this.frameCount * 0.05 + i * 40 + x) % (w + 30)) - 15;
      const cloudY = y + 2 + (i * 4);
      ctx.beginPath();
      ctx.arc(cloudX, cloudY, 3, 0, Math.PI*2);
      ctx.arc(cloudX + 4, cloudY - 2, 4, 0, Math.PI*2);
      ctx.arc(cloudX + 8, cloudY, 3, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
  }

  public render(_interpolation: number) {
    this.frameCount++;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    
    const mapW = GameState.officeLevel >= 3 ? (450 + (GameState.openSpaceBlocks * 320) + 150) : (GameState.officeLevel === 2 ? 500 : 280);
    const mapH = GameState.officeLevel >= 2 ? 300 : 200;
    
    let camX = 0;
    let camY = 0;
    
    if (w >= mapW) {
      camX = -(w - mapW) / 2;
    } else {
      camX = Math.max(0, Math.min(GameState.playerPos.x - w / 2, mapW - w));
    }
    
    if (h >= mapH) {
      camY = -(h - mapH) / 2;
    } else {
      camY = Math.max(0, Math.min(GameState.playerPos.y - h / 2, mapH - h));
    }
    
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-camX, -camY);
    
    const renderables: Renderable[] = [];

    // --- Floor and Walls ---
    if (GameState.officeLevel === 1) {
      // Floor
      ctx.fillStyle = '#6d4c41'; // Brown wood floor
      ctx.fillRect(0, 0, mapW, mapH);
      
      // Floor pattern (planks)
      ctx.fillStyle = '#5d4037';
      for(let i = 0; i < mapW; i += 20) {
        ctx.fillRect(i, 0, 1, mapH);
      }

      // Walls Back
      ctx.fillStyle = '#90a4ae'; // Wall color
      ctx.fillRect(0, 0, mapW, 40);
      ctx.fillStyle = '#78909c'; // Wall bottom trim
      ctx.fillRect(0, 35, mapW, 5);

      // Carpet
      this.drawRect(ctx, mapW / 2 - 40, mapH / 2 - 20, 80, 60, '#8e44ad', '#5b2c6f');
      
      // Window
      ctx.fillStyle = '#111';
      ctx.fillRect(mapW / 2 - 30, 10, 60, 20);
      this.drawSky(ctx, mapW / 2 - 28, 12, 56, 16);

      // Bookcase (à droite de la fenêtre)
      renderables.push({
        y: 60,
        draw: (c) => {
          const bx = mapW / 2 + 40;
          // Ombre au sol
          c.fillStyle = 'rgba(0,0,0,0.15)';
          c.fillRect(bx + 2, 60 - 10 + 2, 30, 10);
          
          // Face dessus
          this.drawRect(c, bx, 60 - 10 - 35 - 10, 30, 10, '#8B4513');
          
          // Face avant (prolongée de 10px vers le bas pour toucher le sol et cacher l'espace)
          this.drawRect(c, bx, 60 - 10 - 35, 30, 45, '#5c2a0b');
          
          // Livres
          c.fillStyle = '#e74c3c'; c.fillRect(bx + 2, 60 - 10 - 35 + 5, 4, 10);
          c.fillStyle = '#3498db'; c.fillRect(bx + 7, 60 - 10 - 35 + 3, 5, 12);
          c.fillStyle = '#f1c40f'; c.fillRect(bx + 13, 60 - 10 - 35 + 7, 3, 8);
          c.fillStyle = '#2ecc71'; c.fillRect(bx + 20, 60 - 10 - 35 + 4, 6, 11);

          c.fillStyle = '#9b59b6'; c.fillRect(bx + 4, 60 - 10 - 35 + 20, 5, 10);
          c.fillStyle = '#e67e22'; c.fillRect(bx + 10, 60 - 10 - 35 + 18, 4, 12);
          
          // Etagères horizontales
          this.drawRect(c, bx, 60 - 10 - 35 + 15, 30, 2, '#5c2a0b');
          this.drawRect(c, bx, 60 - 10 - 35 + 30, 30, 2, '#5c2a0b');
        }
      });

      // Posters
      this.drawRect(ctx, 20, 10, 15, 20, '#e74c3c');
      this.drawRect(ctx, 40, 15, 10, 15, '#2ecc71');

      // Lit étudiant (Nouveau sprite)
      renderables.push({
        y: 80,
        draw: (c) => {
          // Shadow
          c.fillStyle = 'rgba(0,0,0,0.2)';
          c.fillRect(12, 47, 30, 45);
          
          this.drawRect(c, 10, 45, 30, 45, '#8B4513', '#000'); // Frame
          this.drawRect(c, 12, 55, 26, 33, '#ecf0f1', '#000'); // Mattress
          this.drawRect(c, 15, 59, 20, 8, '#fff', '#000'); // Pillow
          this.drawRect(c, 12, 70, 26, 18, '#2980b9', '#000'); // Blanket
        }
      });

      // Balle de tennis (posée au sol ou en l'air)
      renderables.push({
        y: mapH - 10,
        draw: (c) => {
          let bx = 20;
          let by = mapH - 20;
          
          if (GameState.playerActionState === 'playing_tennis') {
            // Animation de rebond contre le mur
            const t = (3000 - GameState.actionTimer) / 1000; // t va de 0 à 3
            // 1 rebond toutes les 0.5s -> freq = 2Hz
            const phase = (t * 2) % 1; 
            
            // x va de 20 (joueur) à 0 (mur) et revient à 20
            bx = phase < 0.5 ? 20 - (phase * 2 * 20) : (phase - 0.5) * 2 * 20;
            // Arc en l'air
            const arc = Math.sin(phase * Math.PI) * 15;
            by = GameState.playerPos.y - 10 - arc;
          }
          
          c.fillStyle = '#ccff00';
          c.beginPath();
          c.arc(bx, by, 3, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = '#000';
          c.lineWidth = 1;
          c.stroke();
        }
      });

      // Small Student Kitchen
      renderables.push({
        y: mapH - 20,
        draw: (c) => {
          const kX = mapW - 50;
          const kY = mapH - 20;
          const kW = 50;
          const kD = 15;
          const kH = 20;
          
          // Countertop
          this.drawIsoBox(c, kX, kY, kW, kD, kH, '#ecf0f1', '#bdc3c7'); 
          
          const topFaceBack = kY - 2 * kD - kH;
          const topFaceFront = kY - kD - kH;
          
          // Sink (sur la face du haut)
          this.drawRect(c, kX + 25, topFaceBack + 2, 10, 10, '#2c3e50');
          // Faucet
          this.drawRect(c, kX + 29, topFaceBack - 6, 2, 6, '#bdc3c7');
          // Hot plate
          this.drawRect(c, kX + 10, topFaceBack + 3, 10, 8, '#111');
          c.fillStyle = '#e74c3c'; c.fillRect(kX + 12, topFaceBack + 5, 2, 2);
          c.fillStyle = '#e74c3c'; c.fillRect(kX + 16, topFaceBack + 5, 2, 2);
          
          // Mini-fridge (intégré dans la face avant)
          this.drawRect(c, kX + 5, kY - kD - kH + 2, 16, 16, '#95a5a6');
          this.drawRect(c, kX + 7, kY - kD - kH + 4, 2, 8, '#7f8c8d');
          
          // Microwave (posé sur le plan de travail)
          const mwX = kX + 2;
          const mwY = topFaceFront + 10; 
          this.drawIsoBox(c, mwX, mwY, 14, 10, 10, '#34495e', '#2c3e50', undefined, false);
          
          // Vitre du micro-onde
          this.drawRect(c, mwX + 2, mwY - 10 - 10 + 2, 8, 6, '#7f8c8d');
        }
      });

      // Toilet Door
      renderables.push({
        y: mapH / 2 + 10,
        draw: (c) => {
          // Door
          this.drawRect(c, mapW - 5, mapH / 2 - 25, 5, 40, '#8B4513');
          // Handle
          c.fillStyle = '#f1c40f'; c.fillRect(mapW - 5, mapH / 2 - 5, 2, 4);
          // WC Sign
          this.drawRect(c, mapW - 25, mapH / 2 - 25, 20, 14, '#3498db', '#fff');
          c.fillStyle = '#fff';
          c.font = "10px monospace";
          c.fillText("WC", mapW - 21, mapH / 2 - 15);
        }
      });

    } else {
      // Floor Agency
      ctx.fillStyle = '#7f8c8d'; 
      ctx.fillRect(0, 0, mapW, mapH);
      
      // Tile grid
      ctx.fillStyle = '#546e7a';
      for(let i = 0; i < mapW; i += 30) ctx.fillRect(i, 0, 1, mapH);
      for(let j = 0; j < mapH; j += 30) ctx.fillRect(0, j, mapW, 1);

      // Walls Back
      ctx.fillStyle = '#95a5a6';
      ctx.fillRect(0, 0, mapW, 40);
      ctx.fillStyle = '#7f8c8d';
      ctx.fillRect(0, 35, mapW, 5);

      // Windows
      const numWindows = GameState.officeLevel >= 3 ? (2 + GameState.openSpaceBlocks) : 1;
      for (let i = 0; i < numWindows; i++) {
        const cx = GameState.officeLevel >= 3 ? (270 + i * 320) : mapW / 2;
        ctx.fillStyle = '#111';
        ctx.fillRect(cx - 60, 10, 120, 20);
        this.drawSky(ctx, cx - 58, 12, 116, 16);
      }

      if (GameState.officeLevel >= 3) {
        for (let b = 0; b <= GameState.openSpaceBlocks; b++) {
          const partitionX = 430 + (b * 320) - 5;
          
          if (partitionX < mapW - 10) { // Don't draw at the very edge
            ctx.fillStyle = 'rgba(189, 195, 199, 0.4)';
            ctx.fillRect(partitionX, 40, 5, mapH / 2 - 30 - 40);
            ctx.fillRect(partitionX, mapH / 2 + 30, 5, mapH - (mapH / 2 + 30));
            
            ctx.fillStyle = '#2c3e50'; // Cadres métalliques
            ctx.fillRect(partitionX, 40, 5, 4);
            ctx.fillRect(partitionX, mapH / 2 - 34, 5, 4);
            ctx.fillRect(partitionX, mapH / 2 + 30, 5, 4);
            ctx.fillRect(partitionX, mapH - 4, 5, 4);
          }
        }
        
        // Salle de réunion
        this.drawRect(ctx, 10, 160, 140, 130, '#8e44ad', '#9b59b6'); // Tapis violet réunion
        
        const th = 15;
        const tableBaseY = 210;
        
        // Chaises (Haut) - Pushed separately so they are behind the table
        renderables.push({
          y: 180,
          draw: (c) => {
            const topC = '#34495e'; const frontC = '#2c3e50';
            const drawChair = (cx: number, cy: number) => {
              c.fillStyle = 'rgba(0,0,0,0.15)';
              c.fillRect(cx - 2 + 2, cy - 10 + 2, 12, 10); // shadow
              this.drawRect(c, cx, cy - 2, 12, 2, '#111'); // roues
              this.drawRect(c, cx + 5, cy - 6, 2, 8, '#111'); // roues
              this.drawIsoBox(c, cx + 4, cy - 2, 4, 4, 14, '#111', '#000', undefined, false); // Pied central
              this.drawIsoBox(c, cx, cy - 10, 12, 10, 4, topC, frontC, undefined, false); // Assise
            };
            drawChair(50, 180); drawChair(75, 180); drawChair(100, 180);
          }
        });

        // Table de réunion
        renderables.push({
          y: tableBaseY + 5, 
          draw: (c) => {
            // Ombre table de réunion
            c.fillStyle = 'rgba(0, 0, 0, 0.15)';
            c.fillRect(40 + 2, tableBaseY - 40 + 2, 80, 40);

            // Pieds table arrière
            this.drawRect(c, 40 + 4, tableBaseY - 40 - th + 4, 4, th - 4, '#111');
            this.drawRect(c, 40 + 80 - 8, tableBaseY - 40 - th + 4, 4, th - 4, '#111');
            
            // Plateau
            this.drawIsoBox(c, 40, tableBaseY - th + 4 + 40, 80, 40, 4, '#d35400', '#e67e22', undefined, false);

            // Pieds table avant
            this.drawRect(c, 40 + 4, tableBaseY - th + 4, 4, th - 4, '#111');
            this.drawRect(c, 40 + 80 - 8, tableBaseY - th + 4, 4, th - 4, '#111');
          }
        });

        // Chaises (Bas) - Pushed separately so they are in front of the table
        renderables.push({
          y: 250,
          draw: (c) => {
            const topC = '#34495e'; const frontC = '#2c3e50';
            const drawChair = (cx: number, cy: number) => {
              c.fillStyle = 'rgba(0,0,0,0.15)';
              c.fillRect(cx - 2 + 2, cy - 10 + 2, 12, 10); // shadow
              this.drawRect(c, cx, cy - 2, 12, 2, '#111'); // roues
              this.drawRect(c, cx + 5, cy - 6, 2, 8, '#111'); // roues
              this.drawIsoBox(c, cx + 4, cy - 2, 4, 4, 14, '#111', '#000', undefined, false); // Pied central
              this.drawIsoBox(c, cx, cy - 10, 12, 10, 4, topC, frontC, undefined, false); // Assise
            };
            drawChair(50, 240); drawChair(75, 240); drawChair(100, 240);
          }
        });

        // Chaise Directeur d'opération (Gauche)
        renderables.push({
          y: tableBaseY - 5,
          draw: (c) => {
            const topC = GameState.hasOperationsDirector ? '#27ae60' : '#7f8c8d';
            c.fillStyle = 'rgba(0,0,0,0.15)';
            c.fillRect(20 - 2, tableBaseY - 5 - 15 + 2, 12, 15);
            this.drawRect(c, 20, tableBaseY - 5 - 2, 12, 2, '#111');
            this.drawRect(c, 25, tableBaseY - 5 - 8, 2, 10, '#111');
            this.drawIsoBox(c, 24, tableBaseY - 5 - 2, 4, 4, 19, '#111', '#000', undefined, false); // Pied
            this.drawIsoBox(c, 20, tableBaseY - 5 - 10, 12, 15, 6, topC, '#2c3e50', undefined, false); // Assise
            if (GameState.hasOperationsDirector && GameState.timeOfDay >= 9 && GameState.timeOfDay < 18) {
              const opsVis = { skinColor: '#e0ac69', shirtColor: '#27ae60', pantsColor: '#111', hairColor: '#111', shoesColor: '#111' };
              this.drawCharacter(c, 25, tableBaseY, false, 'right', false, opsVis);
            }
          }
        });

        // Chaise Directeur Commercial (Droite)
        renderables.push({
          y: tableBaseY - 5,
          draw: (c) => {
            const topC = GameState.hasSalesDirector ? '#3498db' : '#7f8c8d';
            c.fillStyle = 'rgba(0,0,0,0.15)';
            c.fillRect(128 - 2, tableBaseY - 5 - 15 + 2, 12, 15);
            this.drawRect(c, 128, tableBaseY - 5 - 2, 12, 2, '#111');
            this.drawRect(c, 133, tableBaseY - 5 - 8, 2, 10, '#111');
            this.drawIsoBox(c, 132, tableBaseY - 5 - 2, 4, 4, 19, '#111', '#000', undefined, false); // Pied
            this.drawIsoBox(c, 128, tableBaseY - 5 - 10, 12, 15, 6, topC, '#2c3e50', undefined, false); // Assise
            if (GameState.hasSalesDirector && GameState.timeOfDay >= 9 && GameState.timeOfDay < 18) {
              const salesVis = { skinColor: '#f1c40f', shirtColor: '#3498db', pantsColor: '#333', hairColor: '#d35400', shoesColor: '#111' };
              this.drawCharacter(c, 135, tableBaseY, false, 'left', false, salesVis);
            }
          }
        });

        // Tapis bureau direction
        this.drawRect(ctx, 180, 60, 180, 120, '#34495e', '#2c3e50');
        
        // Tapis et décors pour chaque bloc d'employés
        for (let b = 1; b <= GameState.openSpaceBlocks; b++) {
          const startX = 430 + ((b - 1) * 320);
          const poleType = b === 1 ? 'principal' : GameState.purchasedPoles[b - 2];
          
          if (poleType === 'finance') {
            this.drawRect(ctx, startX, 60, 300, 120, '#1e8449', '#27ae60'); // Tapis vert (argent)
            // Tableau de bord boursier sur le mur du fond
            this.drawRect(ctx, startX + 50, 10, 80, 20, '#111', '#333');
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(startX + 55, 20, 10, 5);
            ctx.fillStyle = '#2ecc71'; ctx.fillRect(startX + 70, 15, 10, 10);
            ctx.fillStyle = '#2ecc71'; ctx.fillRect(startX + 85, 12, 10, 13);
            ctx.fillStyle = '#e74c3c'; ctx.fillRect(startX + 100, 18, 10, 7);
          } else if (poleType === 'datacenter') {
            this.drawRect(ctx, startX, 60, 300, 120, '#2c3e50', '#1a252f'); // Tapis très sombre
            
            // Faux faux-plafond / gaines d'aération au mur
            this.drawRect(ctx, startX + 10, 5, 280, 15, '#7f8c8d', '#95a5a6');
            for (let i=0; i<10; i++) {
              ctx.fillStyle = '#34495e';
              ctx.fillRect(startX + 15 + i*25, 5, 10, 15);
            }

            // Baies de Serveurs (renderables)
            for (let s = 0; s < 5; s++) {
               renderables.push({
                 y: 45,
                 draw: (c) => {
                   const sX = startX + 25 + s * 50;
                   // Baie principale sombre
                   this.drawIsoBox(c, sX, 45, 30, 15, 45, '#111', '#000');
                   // Grille avant
                   this.drawRect(c, sX + 2, 45 - 15 - 45 + 2, 26, 41, '#333');
                   
                   // Lignes de lames de serveur
                   for(let blade=0; blade<6; blade++) {
                     const bY = 45 - 15 - 45 + 6 + blade * 6;
                     this.drawRect(c, sX + 4, bY, 22, 3, '#1a1a1a');
                     
                     // LED Animées
                     const t = this.frameCount;
                     const blinkSpeed = 10 + (s * 3) + (blade * 2);
                     
                     const isNetworkActive = (t % blinkSpeed < blinkSpeed / 2);
                     c.fillStyle = isNetworkActive ? '#3498db' : '#2980b9'; 
                     c.fillRect(sX + 6, bY + 1, 2, 1);

                     const isStatusOk = (t % 120 > 5);
                     c.fillStyle = isStatusOk ? '#2ecc71' : '#27ae60'; 
                     c.fillRect(sX + 10, bY + 1, 2, 1);

                     const diskActivity = (Math.sin(t * 0.1 + s + blade) > 0.8);
                     if (diskActivity) {
                       c.fillStyle = '#f1c40f'; 
                       c.fillRect(sX + 14, bY + 1, 2, 1);
                     }
                   }
                 }
               });
            }
          } else if (poleType === 'recherche') {
            this.drawRect(ctx, startX, 60, 300, 120, '#8e44ad', '#9b59b6'); // Tapis violet futuriste
            // Tableau blanc de recherche
            this.drawRect(ctx, startX + 110, 5, 60, 30, '#ecf0f1', '#bdc3c7');
            ctx.fillStyle = '#34495e'; 
            ctx.fillRect(startX + 120, 10, 40, 2);
            ctx.fillRect(startX + 120, 15, 30, 2);
            ctx.fillRect(startX + 120, 25, 20, 2);
            ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(startX + 150, 20, 5, 0, Math.PI*2); ctx.stroke();
          } else if (poleType === 'universite') {
            this.drawRect(ctx, startX, 60, 300, 120, '#d35400', '#e67e22'); // Tapis orange chaleureux
            // Grand tableau à craie vert
            this.drawRect(ctx, startX + 50, 5, 100, 30, '#27ae60', '#2c3e50'); 
            ctx.fillStyle = '#fff';
            ctx.font = "8px monospace";
            ctx.fillText("HTML / CSS", startX + 60, 15);
            ctx.fillText("JAVASCRIPT", startX + 60, 25);
          } else {
            // Principal
            this.drawRect(ctx, startX, 60, 300, 120, '#7f8c8d', '#95a5a6');
          }
        }
      }

      // Plus de bibliothèque spécifique au niveau 2 (les livres sont sur la table basse)

      if (GameState.officeLevel === 2) {
        // Babyfoot en bas à gauche
        renderables.push({
          y: mapH - 40,
          draw: (c) => {
            const bx = 20;
            const by = mapH - 40;
            
            // Ombre manuelle sur le sol
            c.fillStyle = 'rgba(0, 0, 0, 0.15)';
            c.fillRect(bx + 2, by - 20 + 2, 50, 20);

            // Pieds arrière (plus courts)
            this.drawRect(c, bx + 2, by - 32, 3, 12, '#111');
            this.drawRect(c, bx + 45, by - 32, 3, 12, '#111');

            // Caisse principale (bois/orange) plus fine et sans face latérale
            this.drawIsoBox(c, bx, by + 8, 50, 20, 12, '#e67e22', '#d35400', undefined, false);
            
            // Pieds avant (plus courts)
            this.drawRect(c, bx + 2, by - 12, 3, 12, '#111');
            this.drawRect(c, bx + 45, by - 12, 3, 12, '#111');
            
            const topY = by - 44; // Face du haut plus basse

            // Terrain intérieur (vert) dessiné sur la face du haut
            this.drawRect(c, bx + 2, topY + 2, 46, 16, '#27ae60');
            // Lignes
            c.fillStyle = '#fff';
            c.fillRect(bx + 25, topY + 2, 1, 16); // Ligne médiane
            c.beginPath(); c.arc(bx + 25, topY + 10, 3, 0, Math.PI*2); c.stroke(); // Rond central

            // Barres
            c.fillStyle = '#bdc3c7';
            c.fillRect(bx + 10, topY, 2, 20);
            c.fillRect(bx + 20, topY, 2, 20);
            c.fillRect(bx + 30, topY, 2, 20);
            c.fillRect(bx + 40, topY, 2, 20);

            // Joueurs bleus et rouges
            c.fillStyle = '#e74c3c';
            c.fillRect(bx + 9, topY + 8, 4, 4);
            c.fillRect(bx + 19, topY + 4, 4, 4);
            c.fillRect(bx + 19, topY + 12, 4, 4);
            
            c.fillStyle = '#3498db';
            c.fillRect(bx + 29, topY + 4, 4, 4);
            c.fillRect(bx + 29, topY + 12, 4, 4);
            c.fillRect(bx + 39, topY + 8, 4, 4);

            // Balle en mouvement si quelqu'un joue
            if (GameState.playerActionState === 'playing_babyfoot') {
              const t = GameState.actionTimer;
              const ballX = bx + 15 + Math.abs(Math.sin(t * 0.01)) * 20;
              const ballY = topY + 5 + Math.abs(Math.cos(t * 0.013)) * 10;
              c.fillStyle = '#fff';
              c.fillRect(ballX, ballY, 3, 3);
            }
          }
        });
      }

      // Plant (Gauche)
      renderables.push({
        y: 40,
        draw: (c) => {
          // Ombre au sol
          c.fillStyle = 'rgba(0,0,0,0.15)';
          c.fillRect(20 + 2, 40 - 10 + 2, 15, 10);
          
          this.drawIsoBox(c, 20, 50, 15, 10, 15, '#8e44ad', '#732d91', undefined, false); // Pot solid
          this.drawIsoBox(c, 18, 39, 19, 14, 12, '#2ecc71', '#27ae60', undefined, false); // Buisson principal solid
          this.drawIsoBox(c, 22, 21, 11, 8, 8, '#2ecc71', '#27ae60', undefined, false); // Petit sommet solid
        }
      });

      // Tapis de la salle de repos
      renderables.push({
        y: 10,
        draw: (c) => {
          this.drawRect(c, 35, 30, 90, 65, '#2c3e50', '#1a252f'); // Grand tapis
          this.drawRect(c, 40, 35, 80, 55, '#34495e', '#2c3e50'); // Motif intérieur
        }
      });

        // TV on the wall & Meuble mural supprimés à la demande du joueur

      // Petite plante à droite du canapé
      renderables.push({
        y: 55, // Derrière le canapé et la table
        draw: (c) => {
          // Ombre au sol
          c.fillStyle = 'rgba(0,0,0,0.15)';
          c.fillRect(108 + 2, 55 - 12 + 2, 12, 12);
          
          // Pot solid
          this.drawIsoBox(c, 108, 67, 12, 12, 10, '#e67e22', '#d35400', undefined, false); 
          // Buisson principal solid
          this.drawIsoBox(c, 106, 61, 16, 16, 10, '#2ecc71', '#27ae60', undefined, false); 
          // Petit sommet solid
          this.drawIsoBox(c, 110, 43, 8, 8, 6, '#2ecc71', '#27ae60', undefined, false); 
        }
      });

      // Sofa
      renderables.push({
        y: 60,
        draw: (c) => {
          // Ombre globale du canapé manuellement
          c.fillStyle = 'rgba(0, 0, 0, 0.15)';
          c.fillRect(45 + 2, 60 - 15 + 2, 60, 15);

          // Rendu solid avec l'astuce (y + profondeur) pour ancrer les objets au sol de leur footprint
          // Dossier du canapé solid
          this.drawIsoBox(c, 45, 61, 60, 8, 22, '#c0392b', '#a1281c', undefined, false); 
          // Accoudoir gauche solid
          this.drawIsoBox(c, 45, 75, 8, 15, 14, '#c0392b', '#a1281c', undefined, false);
          // Accoudoir droit solid
          this.drawIsoBox(c, 97, 75, 8, 15, 14, '#c0392b', '#a1281c', undefined, false);
          // Assise (coussins) solid
          this.drawIsoBox(c, 53, 75, 44, 15, 10, '#e74c3c', '#c0392b', undefined, false); 
          
          // Séparation des coussins
          c.fillStyle = '#c0392b';
          c.fillRect(74, 35, 2, 15); // Ligne sur la face du haut
          c.fillRect(74, 50, 2, 10); // Ligne sur la face avant
        }
      });

      // Coffee Table (table basse en bois)
      renderables.push({
        y: 95, // Éloignée du canapé (avant: 85)
        draw: (c) => {
          // Ombre de la table
          c.fillStyle = 'rgba(0, 0, 0, 0.15)';
          c.fillRect(55 + 2, 95 - 15 + 2, 40, 15);
          
          // Pieds arrière
          this.drawRect(c, 55 + 2, 95 - 15 - 8 + 4, 3, 8 - 4, '#111');
          this.drawRect(c, 55 + 40 - 5, 95 - 15 - 8 + 4, 3, 8 - 4, '#111');

          // Plateau de la table (solid, posé sur les pieds)
          this.drawIsoBox(c, 55, 95 - 8 + 4 + 15, 40, 15, 4, '#d35400', '#e67e22', undefined, false); 
          
          // Pieds avant
          this.drawRect(c, 55 + 2, 95 - 8 + 4, 3, 8 - 4, '#111');
          this.drawRect(c, 55 + 40 - 5, 95 - 8 + 4, 3, 8 - 4, '#111');

          const topY = 95 - 8 - 15; // Face du haut
          
          // Magazine 1 sur la face du haut
          this.drawRect(c, 60, topY + 2, 8, 10, '#f1c40f');
          this.drawRect(c, 62, topY + 4, 4, 2, '#fff');
          // Magazine 2 sur la face du haut
          this.drawRect(c, 75, topY + 4, 10, 8, '#3498db');
          this.drawRect(c, 76, topY + 6, 4, 4, '#fff');
        }
      });

      // Trash can (Cafétéria)
      renderables.push({
        y: 55,
        draw: (c) => {
          const tX = mapW - 110;
          const tY = 55;
          const tW = 10;
          const tD = 10;
          const tH = 14;
          
          // Ombre portée au sol
          c.fillStyle = 'rgba(0, 0, 0, 0.15)';
          c.fillRect(tX + 2, tY - tD + 2, tW, tD);

          // Corps de la poubelle
          this.drawIsoBox(c, tX, tY, tW, tD, tH, '#7f8c8d', '#95a5a6', undefined, false);
          
          // Couvercle (légèrement surélevé ou dessiné spécifiquement)
          this.drawRect(c, tX, tY - tD - tH, tW, tD, '#111');
          
          // Trou du couvercle
          this.drawRect(c, tX + 2, tY - tD - tH + 2, tW - 4, tD - 4, '#2c3e50');
        }
      });
      
      // Cafeteria (Design amélioré)
      renderables.push({
        y: 55,
        draw: (c) => {
          const cX = mapW - 90;
          const cY = 55;
          const cW = 50;
          const cD = 15;
          const cH = 20;

          // Comptoir en bois avec plan de travail sombre
          this.drawIsoBox(c, cX, cY, cW, cD, cH, '#34495e', '#2c3e50'); // Base
          const topFaceBack = cY - 2 * cD - cH;
          const topFaceFront = cY - cD - cH;
          this.drawRect(c, cX, topFaceBack, cW, cD, '#111'); // Plan de travail
          
          // Micro-ondes posé sur le plan
          const mwX = cX + 5;
          const mwY = topFaceFront + 10;
          this.drawIsoBox(c, mwX, mwY, 15, 10, 10, '#ecf0f1', '#bdc3c7', undefined, false);
          this.drawRect(c, mwX + 2, mwY - 10 - 10 + 2, 8, 6, '#111'); 
          this.drawRect(c, mwX + 11, mwY - 10 - 10 + 2, 2, 2, '#f1c40f'); 
          
          // Machine à café posée sur le plan
          const mdX = cX + 25;
          if (GameState.hasPremiumCoffee) {
            const mdY = topFaceFront + 10;
            this.drawIsoBox(c, mdX, mdY, 12, 10, 15, '#c0392b', '#a1281c', undefined, false); // Premium
            this.drawRect(c, mdX + 2, mdY - 10 - 15 + 2, 8, 4, '#111');
            this.drawRect(c, mdX + 5, mdY - 10 - 15 + 8, 2, 4, '#bdc3c7');
            c.fillStyle = '#fff'; c.fillRect(mdX + 4, mdY - 10 - 15 + 12, 4, 3);
          } else {
            const stdY = topFaceFront + 8;
            this.drawIsoBox(c, mdX, stdY, 10, 8, 12, '#333', '#111', undefined, false); // Standard
            this.drawRect(c, mdX + 3, stdY - 8 - 12 + 6, 4, 4, '#bdc3c7');
          }

          // Grand Frigo Américain
          const fX = mapW - 40;
          const fY = 55;
          this.drawIsoBox(c, fX, fY, 30, 15, 45, '#ecf0f1', '#bdc3c7'); 
          this.drawRect(c, fX + 15, fY - 15 - 45 + 2, 1, 43, '#bdc3c7'); // Séparation
          this.drawRect(c, fX + 13, fY - 15 - 45 + 15, 2, 10, '#7f8c8d'); // Poignée G
          this.drawRect(c, fX + 17, fY - 15 - 45 + 15, 2, 10, '#7f8c8d'); // Poignée D
          this.drawRect(c, fX + 8, fY - 15 - 45 + 20, 6, 8, '#111'); // Distributeur d'eau
        }
      });
      
      // Water cooler
      renderables.push({
        y: 50,
        draw: (c) => {
          this.drawIsoBox(c, mapW - 100, 50, 12, 10, 16, '#ecf0f1', '#bdc3c7'); 
          this.drawRect(c, mapW - 95, 50 - 10 - 2, 4, 2, '#333'); // Grille
          this.drawRect(c, mapW - 98, 50 - 10 - 10, 3, 5, '#fff'); // Bouton
          this.drawIsoBox(c, mapW - 99, 50 - 10 - 16, 10, 8, 14, '#85C1E9', '#3498db'); // Bonbonne d'eau
          this.drawRect(c, mapW - 90, 50 - 10 - 14, 3, 8, '#fff'); // Gobelets
        }
      });

      // Toilet Door (Now on the back wall near the kitchen)
      renderables.push({
        y: 40,
        draw: (c) => {
          // Door on back wall
          this.drawRect(c, mapW - 145, 10, 24, 30, '#ecf0f1');
          // Handle
          c.fillStyle = '#7f8c8d'; c.fillRect(mapW - 140, 25, 4, 2);
          
          // WC Sign sticking out above
          this.drawRect(c, mapW - 140, 0, 14, 10, '#3498db', '#fff');
          c.fillStyle = '#fff';
          c.font = "8px monospace";
          c.fillText("WC", mapW - 138, 8);
        }
      });

      // Cleaning Station
      const sX = mapW - 30; // En bas à droite pour L2 et L3
      const sY = mapH - 50;
      renderables.push({
        y: sY,
        draw: (c) => {
          // Chariot de nettoyage
          this.drawIsoBox(c, sX, sY, 15, 10, 12, '#3498db', '#2980b9'); // Seau bleu
          this.drawRect(c, sX + 2, sY - 10 - 12 - 4, 11, 4, '#111'); // Anse
          
          // Manche à balai
          c.fillStyle = '#f1c40f';
          c.fillRect(sX + 12, sY - 10 - 12 - 25, 2, 35); // Manche
          c.fillStyle = '#ecf0f1';
          c.fillRect(sX + 10, sY - 10 - 12 + 10, 6, 8); // Tête de balai
        }
      });
    }

    // --- Draw Dirt ---
    if (GameState.officeDirt > 0 && !GameState.hasTrashCans) {
      const numDirt = Math.floor(GameState.officeDirt); // 0 to 100 stains
      // Simple pseudo-random using index to keep them stable
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      for (let i = 0; i < numDirt; i++) {
        const dx = Math.abs(Math.sin(i * 123.45)) * mapW;
        const dy = 40 + Math.abs(Math.cos(i * 67.89)) * (mapH - 40);
        ctx.beginPath();
        ctx.arc(dx, dy, 2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fridge Dirt
    if (GameState.fridgeDirt > 0) {
      const numFridgeDirt = Math.floor(GameState.fridgeDirt);
      ctx.fillStyle = 'rgba(139, 69, 19, 0.2)'; // Taches marron/liquide
      
      const fX = GameState.officeLevel === 1 ? mapW - 40 : mapW - 30;
      const fY = GameState.officeLevel === 1 ? mapH - 20 + 5 : 45 + 10;
      const spread = 25;

      for (let i = 0; i < numFridgeDirt; i++) {
        const dx = fX + (Math.sin(i * 99.1) * spread);
        const dy = fY + (Math.cos(i * 88.2) * spread * 0.5); // Perspective iso
        ctx.beginPath();
        ctx.arc(dx, dy, 1 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Dynamic Objects (Desks, Characters) ---
    const deskW = 50;
    const deskD = 15;
    const deskH = 20;

    const renderDeskCount = GameState.officeLevel === 1 ? Math.min(GameState.deskCount, 1) : (GameState.officeLevel === 2 ? Math.min(GameState.deskCount, 6) : GameState.deskCount);

    for (let i = 0; i < renderDeskCount; i++) {
      let deskX, deskY;
      if (GameState.officeLevel === 1) {
        deskX = mapW / 2 - deskW / 2;
        deskY = mapH / 2 + 10;
      } else if (GameState.officeLevel === 2) {
        const cols = 3;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const marginX = deskW + 40;
        const marginY = deskD + 70;
        const totalW = (cols - 1) * marginX + deskW;
        const startX = (mapW - totalW) / 2;
        deskX = startX + (col * marginX);
        deskY = 90 + row * marginY;
      } else {
        // Level 3 (Grand Open Space)
        if (i === 0) {
          // Bureau du Boss (Direction) à gauche
          deskX = 250;
          deskY = mapH / 2;
        } else {
          // Open space pour les employés à droite
          const empIdx = i - 1;
          const blockIdx = Math.floor(empIdx / 9);
          const idxInBlock = empIdx % 9;
          const cols = 3; // 3 cols, 3 rows per block
          const col = idxInBlock % cols;
          const row = Math.floor(idxInBlock / cols);
          
          const startX = 450 + (blockIdx * 320);
          const marginX = deskW + 60;
          const marginY = deskD + 60;
          deskX = startX + (col * marginX);
          deskY = 90 + row * marginY;
        }
      }

      const isPlayer = (i === 0);
      
      // Push desk
      renderables.push({
        y: deskY,
        draw: (c) => {
          if (GameState.officeLevel >= 3 && i === 0) {
            // Modern CEO Desk
            // Ombre au sol
            c.fillStyle = 'rgba(0, 0, 0, 0.15)';
            c.fillRect(deskX + 2, deskY - (deskD + 5) + 2, deskW + 20, deskD + 5);

            // Panneau de fond
            this.drawRect(c, deskX + 5, deskY - (deskD + 5) - deskH + 4, deskW + 10, deskH - 4, '#1a252f');
            
            // Pieds arrière
            this.drawRect(c, deskX + 2, deskY - (deskD + 5) - deskH + 4, 4, deskH - 4, '#111');
            this.drawRect(c, deskX + deskW + 20 - 6, deskY - (deskD + 5) - deskH + 4, 4, deskH - 4, '#111');

            // Plateau du bureau
            this.drawIsoBox(c, deskX, deskY - deskH + 4 + (deskD + 5), deskW + 20, deskD + 5, 4, '#34495e', '#2c3e50', undefined, false);

            // Pieds avant
            this.drawRect(c, deskX + 2, deskY - deskH + 4, 4, deskH - 4, '#111');
            this.drawRect(c, deskX + deskW + 20 - 6, deskY - deskH + 4, 4, deskH - 4, '#111');

            const topY = deskY - deskH - (deskD + 5);
            c.fillStyle = 'rgba(255, 255, 255, 0.1)';
            c.fillRect(deskX, topY + (deskD + 5) / 2, deskW + 20, 2);

            // Accessoires Direction
            this.drawRect(c, deskX + deskW + 20 - 16, topY + (deskD + 5) / 2 + 1, 12, 6, '#111', '#000');
            this.drawRect(c, deskX + 4, topY + 2, 6, 6, '#ecf0f1', '#bdc3c7');
            c.fillStyle = '#000'; c.fillRect(deskX + 5, topY + 3, 4, 4);

            // Grand Laptop ou Double Screen
            const lapW = 30;
            const lapD = 8;
            const lapX = deskX + (deskW + 20) / 2 - lapW / 2;
            
            this.drawRect(c, lapX, topY + deskD + 5 - lapD, lapW, lapD, '#7f8c8d', '#34495e');
            c.fillStyle = '#111'; c.fillRect(lapX + 2, topY + deskD + 5 - lapD + 2, lapW - 4, lapD - 4);
            
            // Grand écran double
            this.drawRect(c, lapX - 10, topY + deskD + 5 - lapD - 14, 24, 14, '#111', '#000');
            c.fillStyle = '#3498db'; c.fillRect(lapX - 8, topY + deskD + 5 - lapD - 12, 20, 10);

            this.drawRect(c, lapX + 16, topY + deskD + 5 - lapD - 14, 24, 14, '#111', '#000');
            c.fillStyle = '#e74c3c'; c.fillRect(lapX + 18, topY + deskD + 5 - lapD - 12, 20, 10);
            
          } else {
            // Normal desk
            let color1 = GameState.officeLevel === 1 ? '#d35400' : '#f39c12';
            let color2 = GameState.officeLevel === 1 ? '#a04000' : '#d68910';
            
            // Joueur au niveau 2 a un bureau distinct (ex: gris foncé/bleu nuit)
            if (isPlayer && GameState.officeLevel === 2) {
              color1 = '#34495e';
              color2 = '#2c3e50';
            }
            
            // Ombre au sol
            c.fillStyle = 'rgba(0, 0, 0, 0.15)';
            c.fillRect(deskX + 2, deskY - deskD + 2, deskW, deskD);

            // Panneau de fond
            this.drawRect(c, deskX + 4, deskY - deskD - deskH + 4, deskW - 8, deskH - 4, color2);
            
            // Pieds arrière
            this.drawRect(c, deskX + 2, deskY - deskD - deskH + 4, 3, deskH - 4, '#111');
            this.drawRect(c, deskX + deskW - 5, deskY - deskD - deskH + 4, 3, deskH - 4, '#111');

            // Plateau du bureau
            this.drawIsoBox(c, deskX, deskY - deskH + 4 + deskD, deskW, deskD, 4, color1, color2, undefined, false);

            // Pieds avant
            this.drawRect(c, deskX + 2, deskY - deskH + 4, 3, deskH - 4, '#111');
            this.drawRect(c, deskX + deskW - 5, deskY - deskH + 4, 3, deskH - 4, '#111');

            // Desk details: dark line across the top
            const topY = deskY - deskH - deskD;
            c.fillStyle = 'rgba(0, 0, 0, 0.3)';
            c.fillRect(deskX, topY + deskD / 2, deskW, 2);

            // Accessoires
            // Tapis de souris
            this.drawRect(c, deskX + deskW - 16, topY + deskD / 2 + 1, 12, 6, '#2c3e50', '#111');
            
            // Tasse de café
            this.drawRect(c, deskX + 4, topY + 2, 6, 6, '#ecf0f1', '#bdc3c7');
            c.fillStyle = '#8B4513'; c.fillRect(deskX + 5, topY + 3, 4, 4);

            // Laptop Base
            const lapW = 20;
            const lapD = 10;
            const lapX = deskX + deskW / 2 - lapW / 2;
            
            // Base du PC (Gris clair)
            this.drawRect(c, lapX, topY + deskD - lapD, lapW, lapD, '#bdc3c7', '#7f8c8d');
            
            // Touches du clavier (Gris foncé)
            c.fillStyle = '#34495e';
            c.fillRect(lapX + 2, topY + deskD - lapD + 2, lapW - 4, lapD - 4);
            
            if (GameState.hasDoubleScreens) {
              // Écran Gauche
              this.drawRect(c, lapX - 10, topY + deskD - lapD - 14, 20, 14, '#2c3e50', '#111');
              c.fillStyle = '#3498db'; c.fillRect(lapX - 8, topY + deskD - lapD - 12, 16, 10);
              
              // Écran Droit
              this.drawRect(c, lapX + 12, topY + deskD - lapD - 14, 20, 14, '#2c3e50', '#111');
              c.fillStyle = '#e74c3c'; c.fillRect(lapX + 14, topY + deskD - lapD - 12, 16, 10);
            } else {
              // Écran du PC (Gris très foncé)
              this.drawRect(c, lapX, topY + deskD - lapD - 14, lapW, 14, '#2c3e50', '#111');
              
              // Écran vert (allumé)
              c.fillStyle = '#2ecc71'; 
              c.fillRect(lapX + 2, topY + deskD - lapD - 12, lapW - 4, 10);
            }
          }

          // Poubelle de bureau
          if (GameState.hasTrashCans) {
            const trashX = deskX - 16;
            const trashY = deskY;
            const tW = 10;
            const tD = 8;
            const tH = 14;
            
            // Ombre portée au sol (mieux alignée et personnalisée)
            c.fillStyle = 'rgba(0, 0, 0, 0.15)';
            c.fillRect(trashX + 2, trashY - tD + 2, tW, tD);

            // Face intérieure (fond + sol de la corbeille)
            this.drawRect(c, trashX, trashY - tD - tH - tD, tW, tH + tD, '#2c3e50', '#1a252f');

            // Si la saleté augmente, la poubelle se remplit visuellement
            if (GameState.officeDirt > 0) {
              const fillLevel = Math.min(1, GameState.officeDirt / 100);
              const maxPaperH = tH + tD - 2;
              const paperH = maxPaperH * fillLevel;
              const paperY = trashY - tD - tH - tD + (maxPaperH - paperH) + 2;
              
              c.fillStyle = '#ecf0f1'; // Papiers blancs/clairs
              c.fillRect(trashX + 1, paperY, tW - 2, paperH);
              
              // Quelques confettis pour faire "déchets de bureau"
              c.fillStyle = '#e74c3c'; c.fillRect(trashX + 2, paperY + 1, 2, 2);
              c.fillStyle = '#3498db'; c.fillRect(trashX + tW - 4, paperY + paperH/2, 2, 2);
              c.fillStyle = '#f1c40f'; c.fillRect(trashX + 4, paperY + Math.max(0, paperH - 4), 2, 2);
            }

            // Face avant (avec légère transparence pour voir à travers si on veut, ou juste un rebord)
            this.drawRect(c, trashX, trashY - tD - tH, tW, tH, '#95a5a6', '#7f8c8d');
            
            // Rebord épais sur le haut de la façade avant pour donner le look "bac ouvert"
            c.fillStyle = '#7f8c8d';
            c.fillRect(trashX, trashY - tD - tH, tW, 2);
          }
        }
      });

      // Push chair
      const charX = deskX + (GameState.officeLevel >= 3 && i === 0 ? (deskW + 20) / 2 : deskW / 2);
      const charY = deskY + 15;
      renderables.push({
        y: charY,
        draw: (c) => {
          if (GameState.officeLevel >= 3 && i === 0) {
            // Ombre au sol
            c.fillStyle = 'rgba(0,0,0,0.15)';
            c.fillRect(charX - 12 + 2, charY - 12 + 2, 24, 12);
            
            // Roulettes
            this.drawRect(c, charX - 10, charY - 2, 20, 2, '#111');
            this.drawRect(c, charX - 1, charY - 8, 2, 10, '#111');

            // Pied central
            this.drawIsoBox(c, charX - 2, charY - 2, 4, 4, 16, '#111', '#000', undefined, false);
            // Fauteuil de Direction
            this.drawIsoBox(c, charX - 12, charY - 10, 24, 12, 6, '#2c3e50', '#1a252f', undefined, false);
            this.drawRect(c, charX - 12, charY - 10 - 12 - 6 - 20, 24, 24, '#2c3e50', '#000');
            // Accoudoirs
            this.drawRect(c, charX - 14, charY - 10 - 12 - 6 - 10, 3, 12, '#111', '#000');
            this.drawRect(c, charX + 11, charY - 10 - 12 - 6 - 10, 3, 12, '#111', '#000');
          } else {
            const c1 = GameState.officeLevel === 1 ? '#7f8c8d' : '#2980b9'; // Gris (garage) / Bleu (agence)
            const c2 = GameState.officeLevel === 1 ? '#95a5a6' : '#2471a3';
            
            // Ombre au sol
            c.fillStyle = 'rgba(0,0,0,0.15)';
            c.fillRect(charX - 10 + 2, charY - 10 + 2, 20, 10);
            
            // Roulettes
            this.drawRect(c, charX - 8, charY - 2, 16, 2, '#111');
            this.drawRect(c, charX - 1, charY - 6, 2, 8, '#111');

            // Pied central
            this.drawIsoBox(c, charX - 2, charY - 2, 4, 4, 14, '#333', '#111', undefined, false);
            
            // Siège
            this.drawIsoBox(c, charX - 10, charY - 10, 20, 10, 4, c1, c2, undefined, false);
            
            // Dossier
            this.drawRect(c, charX - 10, charY - 10 - 10 - 4 - 12, 20, 16, c1, '#000');
            
            // Accoudoirs
            this.drawRect(c, charX - 12, charY - 10 - 10 - 4 - 6, 2, 8, '#111', '#000');
            this.drawRect(c, charX + 10, charY - 10 - 10 - 4 - 6, 2, 8, '#111', '#000');
          }
        }
      });

      // Employee / Player
      if (isPlayer) {
        const distToDesk = Math.hypot(GameState.playerPos.x - charX, GameState.playerPos.y - charY);
        GameState.isPlayerAtDesk = distToDesk < 30;

        renderables.push({
          y: GameState.playerPos.y + 5, // Sort point at feet
          draw: (c) => {
            const isWorkingPlayer = GameState.projectInfos.size > 0 && GameState.isPlayerAtDesk;
            this.drawCharacter(c, GameState.playerPos.x, GameState.playerPos.y, isWorkingPlayer, GameState.playerDir, GameState.isMoving);
          }
        });
      }
    }

    // Employees Rendering from AI system
    for (const [, info] of GameState.employeesInfo.entries()) {
      if (info.state !== 'off_duty') {
        renderables.push({
          y: info.y + 5,
          draw: (c) => {
            const isWorkingEmp = info.state === 'working' && GameState.projectInfos.size > 0;
            this.drawCharacter(c, info.x, info.y, isWorkingEmp, info.dir, info.isMoving, info.visuals);
          }
        });
      }
    }

    // Assistant Rendering
    if (GameState.officeLevel >= 3) {
      const aX = 285;
      const aY = mapH / 2 - 40;

      // Chaise de l'assistant
      renderables.push({
        y: aY + 2,
        draw: (c) => {
          // Ombre au sol
          c.fillStyle = 'rgba(0,0,0,0.15)';
          c.fillRect(aX - 8 + 2, aY + 2 - 10 + 2, 16, 10);
          
          // Roulettes
          this.drawRect(c, aX - 6, aY + 2 - 2, 12, 2, '#111');
          this.drawRect(c, aX - 1, aY + 2 - 6, 2, 8, '#111');

          // Pied central
          this.drawIsoBox(c, aX - 2, aY + 2 - 2, 4, 4, 14, '#111', '#000', undefined, false);
          // Assise de la chaise
          this.drawIsoBox(c, aX - 6, aY + 2 - 10, 12, 10, 4, '#34495e', '#2c3e50', undefined, false); 
          // Dossier de la chaise
          this.drawIsoBox(c, aX - 8, aY + 2 - 10 - 4, 4, 10, 14, '#2c3e50', '#1a252f'); 
        }
      });

      // Bureau de l'assistant
      renderables.push({
        y: aY - 5,
        draw: (c) => {
          // Ombre au sol
          c.fillStyle = 'rgba(0, 0, 0, 0.15)';
          c.fillRect(aX - 25 + 2, aY - 5 - 15 + 2, 50, 15);

          // Panneau de fond
          this.drawRect(c, aX - 25 + 4, aY - 5 - 15 - 18 + 4, 50 - 8, 18 - 4, '#95a5a6');

          // Pieds arrière
          this.drawRect(c, aX - 25 + 2, aY - 5 - 15 - 18 + 4, 3, 18 - 4, '#111');
          this.drawRect(c, aX - 25 + 50 - 5, aY - 5 - 15 - 18 + 4, 3, 18 - 4, '#111');

          // Plateau du bureau
          this.drawIsoBox(c, aX - 25, aY - 5 - 18 + 4 + 15, 50, 15, 4, '#bdc3c7', '#95a5a6', undefined, false);

          // Pieds avant
          this.drawRect(c, aX - 25 + 2, aY - 5 - 18 + 4, 3, 18 - 4, '#111');
          this.drawRect(c, aX - 25 + 50 - 5, aY - 5 - 18 + 4, 3, 18 - 4, '#111');
          
          const deskTopY = aY - 25;
          
          // Ecran sombre unique
          this.drawRect(c, aX - 10, deskTopY - 12, 4, 8, '#333'); // Pied
          this.drawRect(c, aX - 14, deskTopY - 22, 20, 14, '#111', '#000'); // Cadre
          this.drawRect(c, aX - 12, deskTopY - 20, 16, 10, '#2c3e50'); // Ecran sombre (éteint/veille)

          // Clavier & Souris
          this.drawIsoBox(c, aX - 10, deskTopY - 3, 14, 5, 1, '#7f8c8d', '#95a5a6'); 
          c.fillStyle = '#111'; c.fillRect(aX + 8, deskTopY - 5, 3, 2); // Souris

          // Dossier
          this.drawIsoBox(c, aX + 12, deskTopY - 4, 8, 6, 2, '#ecf0f1', '#fff'); 
        }
      });

      if (GameState.hasAssistant && GameState.timeOfDay >= 9 && GameState.timeOfDay < 18) {
        renderables.push({
          y: aY + 5,
          draw: (c) => {
            // Visual custom pour l'assistant(e)
            const assistantVisuals = {
              skinColor: '#f1c40f',
              shirtColor: '#9b59b6', // Violet
              pantsColor: '#34495e',
              hairColor: '#e67e22',
              shoesColor: '#111'
            };
            this.drawCharacter(c, aX + 4, aY, false, 'up', false, assistantVisuals);
          }
        });
      }
    }

    // --- Sort and Draw ---
    renderables.sort((a, b) => a.y - b.y);
    for (const r of renderables) {
      r.draw(ctx);
    }
    
    ctx.restore();
  }

  private drawCharacter(ctx: CanvasRenderingContext2D, x: number, y: number, isWorking: boolean, dir: string, isMoving: boolean, visuals?: any) {
    // Animation state
    let walkAnim = 0;
    if (isMoving) {
      walkAnim = Math.sin(this.frameCount * 0.15) * 3;
    }
    
    let bobY = 0;
    if (isMoving) {
      bobY = -Math.abs(Math.sin(this.frameCount * 0.15)) * 2;
    }

    // Shadow on floor
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y, 10, 4, 0, 0, Math.PI * 2); ctx.fill();

    const drawPart = (px: number, py: number, pw: number, ph: number, color: string) => {
      this.drawRect(ctx, px, py, pw, ph, color);
    };

    const skin = visuals?.skinColor || '#f1c40f';
    const shirt = visuals?.shirtColor || '#e74c3c';
    const pants = visuals?.pantsColor || '#2980b9';
    const hair = visuals?.hairColor || '#3e2723';
    const shoes = visuals?.shoesColor || '#333';

    // Work animation overrides movement
    if (isWorking && !isMoving) {
      bobY = (Math.sin(this.frameCount * 0.1) * 1) - 2; // subtle bob
      
      // Face UP (Back) typing
      drawPart(x - 6, y - 8, 5, 8, pants);
      drawPart(x + 1, y - 8, 5, 8, pants);
      drawPart(x - 8, y - 20 + bobY, 16, 12, shirt);
      
      const armAnim = Math.sin(this.frameCount * 0.5) * 3;
      drawPart(x - 12, y - 18 + bobY + armAnim, 4, 8, skin);
      drawPart(x + 8, y - 18 + bobY - armAnim, 4, 8, skin);
      
      drawPart(x - 6, y - 32 + bobY, 12, 12, hair);
    } else {
      // Normal rendering
      const cy = y - 10 + bobY; // Base center of character body

      if (dir === 'down') {
        drawPart(x - 6, cy + walkAnim, 5, 10, pants);
        drawPart(x + 1, cy - walkAnim, 5, 10, pants);
        drawPart(x - 6, cy + 10 + walkAnim, 5, 3, shoes);
        drawPart(x + 1, cy + 10 - walkAnim, 5, 3, shoes);
        
        drawPart(x - 8, cy - 12, 16, 14, shirt);
        
        drawPart(x - 12, cy - 10 - walkAnim, 4, 10, skin);
        drawPart(x + 8, cy - 10 + walkAnim, 4, 10, skin);
        
        drawPart(x - 7, cy - 26, 14, 14, skin);
        ctx.fillStyle = '#000'; ctx.fillRect(x - 4, cy - 20, 2, 2); ctx.fillRect(x + 2, cy - 20, 2, 2);
        
        drawPart(x - 8, cy - 28, 16, 6, hair);
        drawPart(x - 8, cy - 22, 3, 4, hair); 
        drawPart(x + 5, cy - 22, 3, 4, hair);
      } 
      else if (dir === 'up') {
        drawPart(x - 6, cy - walkAnim, 5, 10, pants);
        drawPart(x + 1, cy + walkAnim, 5, 10, pants);
        drawPart(x - 6, cy + 10 - walkAnim, 5, 3, shoes);
        drawPart(x + 1, cy + 10 + walkAnim, 5, 3, shoes);
        
        drawPart(x - 8, cy - 12, 16, 14, shirt);
        
        drawPart(x - 12, cy - 10 + walkAnim, 4, 10, skin);
        drawPart(x + 8, cy - 10 - walkAnim, 4, 10, skin);
        
        drawPart(x - 7, cy - 26, 14, 14, hair);
        drawPart(x - 8, cy - 28, 16, 14, hair);
      }
      else if (dir === 'left') {
        drawPart(x - 4 + walkAnim, cy, 6, 10, pants);
        drawPart(x - 2 - walkAnim, cy, 6, 10, pants);
        drawPart(x - 5 + walkAnim, cy + 10, 6, 3, shoes);
        drawPart(x - 3 - walkAnim, cy + 10, 6, 3, shoes);

        drawPart(x - 6, cy - 12, 12, 14, shirt);
        drawPart(x - 2, cy - 10 - walkAnim, 4, 10, skin);

        drawPart(x - 6, cy - 26, 12, 14, skin);
        ctx.fillStyle = '#000'; ctx.fillRect(x - 4, cy - 20, 2, 2);
        
        drawPart(x - 7, cy - 28, 14, 6, hair);
        drawPart(x, cy - 22, 6, 10, hair);
      }
      else if (dir === 'right') {
        drawPart(x - 2 - walkAnim, cy, 6, 10, pants);
        drawPart(x - 4 + walkAnim, cy, 6, 10, pants);
        drawPart(x - 3 - walkAnim, cy + 10, 6, 3, shoes);
        drawPart(x - 5 + walkAnim, cy + 10, 6, 3, shoes);

        drawPart(x - 6, cy - 12, 12, 14, shirt);
        drawPart(x - 2, cy - 10 + walkAnim, 4, 10, skin);

        drawPart(x - 6, cy - 26, 12, 14, skin);
        ctx.fillStyle = '#000'; ctx.fillRect(x + 2, cy - 20, 2, 2);
        
        drawPart(x - 7, cy - 28, 14, 6, hair);
        drawPart(x - 6, cy - 22, 6, 10, hair);
      }
    }

    // Interaction Tooltip & Action Bubble for Player
    if (this.isPlayer(x, y)) { // We need a way to know if this is the player
      const state = GameState.playerActionState;
      let text = "";
      
      if (state !== 'idle') {
        if (state === 'sleeping') {
          const dots = Math.floor(this.frameCount * 0.05) % 4;
          text = "Z" + "z".repeat(dots);
        } else if (state === 'eating') {
          const frame = Math.floor(this.frameCount * 0.1) % 2;
          text = frame ? "Miam" : "Miam.";
        } else if (state === 'toilet') {
          const dots = Math.floor(this.frameCount * 0.05) % 4;
          text = ".".repeat(dots);
        } else if (state === 'playing_tennis') {
          text = "Boing !";
        } else if (state === 'reading') {
          text = "Lecture...";
        } else if (state === 'playing_babyfoot') {
          const frame = Math.floor(this.frameCount * 0.1) % 2;
          text = frame ? "Go !" : "Passe !";
        }
      } else if (GameState.nearInteractable) {
        if (GameState.nearInteractable === 'bed') text = "[E] Dormir";
        if (GameState.nearInteractable === 'food') text = "[E] Boire/Manger";
        if (GameState.nearInteractable === 'toilet') text = "[E] Toilettes";
        if (GameState.nearInteractable === 'tennis') text = "[E] Jouer à la balle";
        if (GameState.nearInteractable === 'babyfoot') text = "[E] Jouer au Baby-foot";
        if (GameState.nearInteractable === 'bookcase') {
          text = GameState.hasReadBookToday ? "Déjà lu aujourd'hui" : "[E] Lire un livre (+XP)";
        }
        if (GameState.nearInteractable === 'assistant') {
          text = GameState.hasAssistant ? "[E] Assistant(e)" : "[E] Recruter";
        }
        if (GameState.nearInteractable === 'ops_director') {
          text = GameState.hasOperationsDirector ? "[E] Dir. Opérations" : "[E] Recruter Dir. Opérations";
        }
        if (GameState.nearInteractable === 'sales_director') {
          text = GameState.hasSalesDirector ? "[E] Dir. Commercial" : "[E] Recruter Dir. Commercial";
        }
        if (GameState.nearInteractable === 'cleaning_station') {
          text = GameState.hasCleaner ? "Agent d'entretien actif" : "[E] Engager Agent d'entretien";
        }
      }

      if (text) {
        ctx.font = "10px monospace";
        const tw = ctx.measureText(text).width;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x - tw / 2 - 2, y - 45, tw + 4, 14);
        ctx.fillStyle = '#fff';
        ctx.fillText(text, x - tw / 2, y - 35);
      }
    }
  }

  private isPlayer(x: number, y: number): boolean {
    return Math.abs(GameState.playerPos.x - x) < 1 && Math.abs(GameState.playerPos.y - y) < 1;
  }
}
