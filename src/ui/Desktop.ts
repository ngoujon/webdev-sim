import { WindowManager } from './WindowManager';
import { GameState } from '../sim/gameState';
import { EventBus } from '../core/EventBus';

import { audioEngine } from '../audio/AudioEngine';

export class DesktopUI {
  private wm: WindowManager;

  constructor() {
    this.wm = new WindowManager('ui-layer');
    this.initDesktopIcons();
    
    (window as any).closeDialog = (id: string) => {
      this.wm.closeWindow(id);
    };
    
    EventBus.on('MONEY_CHANGED', () => {
      this.updateStatsOverlay();
      this.updateFinanceWindow();
    });
    EventBus.on('TIME_TICK', () => {
      this.updateStatsOverlay();
      if (this.wm.hasWindow('recruit')) {
        this.renderRecruit();
      }
    });
    EventBus.on('XP_CHANGED', () => {
      this.updateStatsOverlay();
    });
    EventBus.on('LEVEL_UP', (newLevel) => {
      this.showDialog("Level Up !", `Félicitations, vous êtes maintenant Niveau ${newLevel} !`);
      this.updateStatsOverlay();
    });
    EventBus.on('NEEDS_CHANGED', () => {
      this.updateNeedsOverlay();
    });
  }

  private initDesktopIcons() {
    // Bouton de contrat en bas à gauche façon "Start menu" ou icône de bureau
    const uiLayer = document.getElementById('ui-layer')!;
    
    const taskbar = document.createElement('div');
    taskbar.style.position = 'absolute';
    taskbar.style.bottom = '0';
    taskbar.style.left = '0';
    taskbar.style.width = '100%';
    taskbar.style.height = '40px';
    taskbar.style.background = 'var(--window-bg)';
    taskbar.style.borderTop = '2px solid var(--window-border-light)';
    taskbar.style.display = 'flex';
    taskbar.style.alignItems = 'center';
    taskbar.style.padding = '0 4px';
    taskbar.style.pointerEvents = 'auto';

    const startBtn = document.createElement('button');
    startBtn.className = 'os-btn';
    startBtn.innerText = '💻 Contrats';
    startBtn.style.fontWeight = 'bold';
    startBtn.onclick = () => this.openContractsWindow();

    const realEstateBtn = document.createElement('button');
    realEstateBtn.className = 'os-btn';
    realEstateBtn.innerText = '🏢 Locaux';
    realEstateBtn.style.marginLeft = '4px';
    realEstateBtn.onclick = () => this.openRealEstateWindow();

    const recruitBtn = document.createElement('button');
    recruitBtn.id = 'btn-recruit';
    recruitBtn.className = 'os-btn';
    recruitBtn.innerText = '👥 Recruter';
    recruitBtn.style.marginLeft = '4px';
    recruitBtn.style.display = GameState.officeLevel > 1 ? 'block' : 'none';
    recruitBtn.onclick = () => this.openRecruitWindow();

    const progressBtn = document.createElement('button');
    progressBtn.className = 'os-btn';
    progressBtn.innerText = '📈 Projet';
    progressBtn.style.marginLeft = '4px';
    progressBtn.onclick = () => this.openProjectProgressWindow();

    const historyBtn = document.createElement('button');
    historyBtn.className = 'os-btn';
    historyBtn.innerText = '📁 Historique';
    historyBtn.style.marginLeft = '4px';
    historyBtn.onclick = () => this.openCompletedProjectsWindow();

    const financeBtn = document.createElement('button');
    financeBtn.className = 'os-btn';
    financeBtn.innerText = '💰 Finances';
    financeBtn.style.marginLeft = '4px';
    financeBtn.onclick = () => this.openFinanceWindow();

    const timeContainer = document.createElement('div');
    timeContainer.style.marginLeft = 'auto'; // Pousse à droite
    timeContainer.style.display = 'flex';
    timeContainer.style.alignItems = 'center';
    timeContainer.style.marginRight = '8px';

    const notifDisplay = document.createElement('div');
    notifDisplay.id = 'taskbar-notification';
    notifDisplay.style.color = '#2ecc71';
    notifDisplay.style.fontFamily = "'VT323', monospace";
    notifDisplay.style.fontSize = '20px';
    notifDisplay.style.marginRight = '15px';
    notifDisplay.style.opacity = '0';
    notifDisplay.style.transition = 'opacity 0.5s';
    notifDisplay.innerText = '';

    const timeDisplay = document.createElement('div');
    timeDisplay.id = 'taskbar-time';
    timeDisplay.style.color = 'var(--text-color)';
    timeDisplay.style.fontFamily = "'VT323', monospace";
    timeDisplay.style.fontSize = '22px';
    timeDisplay.innerText = this.getFormattedTime();

    timeContainer.appendChild(notifDisplay);
    timeContainer.appendChild(timeDisplay);

    taskbar.appendChild(startBtn);
    taskbar.appendChild(realEstateBtn);
    taskbar.appendChild(recruitBtn);
    taskbar.appendChild(progressBtn);
    taskbar.appendChild(historyBtn);
    taskbar.appendChild(financeBtn);
    taskbar.appendChild(timeContainer);
    uiLayer.appendChild(taskbar);
    
    this.initNeedsOverlay();
    this.initStatsOverlay();
  }

  private notifTimeout: number | null = null;

  public showTaskbarNotification(text: string) {
    const el = document.getElementById('taskbar-notification');
    if (el) {
      el.innerText = text;
      el.style.opacity = '1';
      
      if (this.notifTimeout) {
        clearTimeout(this.notifTimeout);
      }
      this.notifTimeout = window.setTimeout(() => {
        el.style.opacity = '0';
      }, 5000) as unknown as number;
    }
  }

  private getFormattedTime(): string {
    const hours = Math.floor(GameState.timeOfDay).toString().padStart(2, '0');
    const mins = Math.floor((GameState.timeOfDay % 1) * 60).toString().padStart(2, '0');
    return `Jour ${GameState.day} - ${hours}:${mins}`;
  }

  private toggleWindow(id: string, openFn: () => void) {
    if (this.wm.hasWindow(id)) {
      this.wm.closeWindow(id);
    } else {
      openFn();
    }
  }

  public closeWindowIfOpen(id: string) {
    if (this.wm.hasWindow(id)) {
      this.wm.closeWindow(id);
    }
  }

  public openPauseMenu() {
    this.toggleWindow('pause-menu', () => {
      GameState.isPaused = true;
      
      let content = `<div style="text-align: center; font-size: 22px;">
        <h2 style="margin-top: 0;">Menu Pause</h2>
        <button class="os-btn" style="width: 200px; margin-bottom: 10px;" onclick="window.saveGame()">Sauvegarder</button><br/>
        <button class="os-btn" style="width: 200px; margin-bottom: 10px;" onclick="window.openSettings()">Commandes</button><br/>
        <button class="os-btn" style="width: 200px; margin-bottom: 10px;" onclick="window.openAudioSettings()">Audio</button><br/>
        <button class="os-btn" style="width: 200px; margin-bottom: 10px; background: #e74c3c; color: white;" onclick="window.quitToMenu()">Quitter vers l'accueil</button><br/>
        <button class="os-btn" style="width: 200px; margin-top: 15px; background: #27ae60; color: white;" onclick="window.resumeGame()">Reprendre</button>
      </div>`;

      this.wm.createWindow({
        id: 'pause-menu',
        title: 'Menu Pause',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 2 - 150,
        width: 450,
        contentHtml: content,
        onClose: () => { GameState.isPaused = false; }
      });
    });
  }

  public openSettingsWindow() {
    this.toggleWindow('settings', () => {
      this.wm.createWindow({
        id: 'settings',
        title: 'Commandes',
        x: window.innerWidth / 2 - 125,
        y: window.innerHeight / 2 - 100,
        width: 300,
        contentHtml: `
          <div style="font-size: 24px;">
            <h3>Déplacements</h3>
            <p><strong>Z / W :</strong> Haut</p>
            <p><strong>S :</strong> Bas</p>
            <p><strong>Q / A :</strong> Gauche</p>
            <p><strong>D :</strong> Droite</p>
            <p style="margin-top:10px; text-align:center;">
               <button class="os-btn" onclick="window.closeDialog('settings')">Fermer</button>
            </p>
          </div>
        `
      });
    });
  }

  public openAudioWindow() {
    this.toggleWindow('audio-settings', () => {
      const v = audioEngine.volumes;
      this.wm.createWindow({
        id: 'audio-settings',
        title: 'Audio',
        x: window.innerWidth / 2 - 125,
        y: window.innerHeight / 2 - 100,
        width: 300,
        contentHtml: `
          <div style="font-size: 24px;">
            <p>
              Master: <input type="range" id="vol-master" min="0" max="1" step="0.1" value="${v.master}" onchange="window.updateAudio()" />
            </p>
            <p>
              Musique (BGM): <input type="range" id="vol-bgm" min="0" max="1" step="0.1" value="${v.bgm}" onchange="window.updateAudio()" />
            </p>
            <p>
              SFX: <input type="range" id="vol-sfx" min="0" max="1" step="0.1" value="${v.sfx}" onchange="window.updateAudio()" />
            </p>
            <p style="margin-top:10px; text-align:center;">
               <button class="os-btn" onclick="window.closeDialog('audio-settings')">Fermer</button>
            </p>
          </div>
        `
      });
    });
  }

  public isContractsWindowOpen(): boolean {
    return this.wm.hasWindow('contracts');
  }

  public openContractsWindow() {
    this.toggleWindow('contracts', () => {
      this.wm.createWindow({
        id: 'contracts',
        title: 'Freelance Board',
        x: 50,
        y: 50,
        width: 450,
        contentHtml: `
          <div id="contracts-list">
            Chargement des contrats...
          </div>
        `
      });
      
      // Demander la liste des contrats au système
      EventBus.emit('REQUEST_CONTRACTS');
    });
  }

  public renderContracts(contracts: any[]) {
    let html = '<ul style="list-style:none; padding:0; margin:0;">';
    if (contracts.length === 0) {
      html += `<li style="padding: 8px; text-align: center; color: #7f8c8d;">Aucun contrat disponible pour le moment.<br/>Revenez demain !</li>`;
    } else {
      contracts.forEach(c => {
        const isPremium = c.title.includes('Sur Mesure');
        const bgColor = isPremium ? 'rgba(241, 196, 15, 0.1)' : 'transparent';
        const deadlineText = c.deadlineDays ? `${c.deadlineDays} jours` : 'Non défini';
        
        html += `
          <li style="border-bottom:1px solid #808080; padding-bottom:8px; margin-bottom:8px; background: ${bgColor}; padding: 4px;">
            <strong>${c.title}</strong><br/>
            Budget: $${c.budget} | Échéance: ${deadlineText}<br/>
            <span style="font-size: 14px; color: #555;">Frontend: ${c.requiredTasks.frontend} | Backend: ${c.requiredTasks.backend} | Design: ${c.requiredTasks.design}</span><br/>
            <button class="os-btn" style="margin-top:4px;" onclick="window.acceptContract('${c.id}')">Accepter</button>
          </li>
        `;
      });
    }
    html += '</ul>';
    this.wm.updateWindowContent('contracts', html);
  }

  public openRecruitWindow() {
    this.toggleWindow('recruit', () => {
      this.wm.createWindow({
        id: 'recruit',
        title: 'Agence de Recrutement',
        x: 150,
        y: 150,
        width: 450,
        contentHtml: this.getRecruitHtml()
      });
    });
  }

  public renderRecruit() {
    this.wm.updateWindowContent('recruit', this.getRecruitHtml());
  }

  private getRecruitHtml(): string {
    let html = `<div style="font-size: 24px;">
      <p><strong>Équipe :</strong> ${GameState.employeesCount} / ${GameState.deskCount}</p>`;
      
    // Liste de l'équipe actuelle
    if (GameState.employeesInfo.size > 0) {
      html += `<div style="margin-bottom: 12px; max-height: 120px; overflow-y: auto; border: 1px solid #ccc; padding: 4px; background: rgba(255,255,255,0.7);">
                <strong style="display:block; margin-bottom: 4px;">Votre Équipe :</strong>
                <ul style="list-style:none; padding:0; margin:0; font-size: 18px;">`;
      for (const [eid, info] of GameState.employeesInfo.entries()) {
        const lvlStr = info.role === 'dev' || info.role === 'designer' ? ` - Lvl ${info.level} (${Math.floor(info.xp)}/${info.xpToNextLevel} XP)` : '';
        html += `
          <li style="border-bottom:1px dashed #999; padding-bottom:4px; margin-bottom:4px;">
            ${info.title}${lvlStr} ($${info.salary}/sem)<br/>
            <button class="os-btn" style="background:#e74c3c; color:#fff; font-size:20px; padding:2px 4px; margin-top:2px;" onclick="window.fireEmployee(${eid})">Renvoyer</button>
          </li>
        `;
      }
      html += `</ul></div>`;
    }

    if (GameState.employeesCount >= GameState.deskCount) {
      html += `<p style="color: red; font-weight: bold;">Pas de bureau disponible. Déménagez ou ajoutez des box.</p>`;
    } else {
      let costMultiplier = 1;
      let hasHR = false;
      for (const info of GameState.employeesInfo.values()) {
        if (info.role === 'hr') hasHR = true;
      }
      if (hasHR) costMultiplier = 0.5; // -50% coût de recrutement

      const getCost = (base: number) => Math.floor(base * costMultiplier);

      html += `
        <ul style="list-style:none; padding:0; margin:0;">
      `;

      if (GameState.availableCandidates.length === 0) {
        html += `<li style="padding: 8px; text-align: center; color: #7f8c8d;">Aucun candidat disponible pour le moment.<br/>Revenez demain !</li>`;
      } else {
        for (const candidate of GameState.availableCandidates) {
          let bgColor = 'transparent';
          if (candidate.type === 'pm') bgColor = 'rgba(52, 152, 219, 0.1)';
          if (candidate.type === 'hr') bgColor = 'rgba(142, 68, 173, 0.1)';
          if (candidate.type === 'sales') bgColor = 'rgba(39, 174, 96, 0.1)';

          html += `
            <li style="border-bottom:1px solid #808080; padding-bottom:8px; margin-bottom:8px; background: ${bgColor}; padding: 4px;">
              <strong>${candidate.name}</strong> - <em>${candidate.title}</em><br/>
              Coût: $${getCost(candidate.baseCost)} | Salaire: $${candidate.salary}/sem<br/>
              <span style="font-size: 16px; color: #555;">${candidate.description}</span><br/>
              <button class="os-btn" style="margin-top:4px;" onclick="window.recruitEmployee('${candidate.id}', ${getCost(candidate.baseCost)})">Recruter</button>
            </li>
          `;
        }
      }

      html += `</ul>`;
    }
    html += `</div>`;
    return html;
  }

  public isProjectProgressWindowOpen(): boolean {
    return this.wm.hasWindow('project-progress');
  }

  public getOpenWindowsState(): Array<{id: string, x: number, y: number}> {
    return this.wm.getWindowsState();
  }

  public restoreWindowsState(windows: Array<{id: string, x: number, y: number}>) {
    if (!windows || windows.length === 0) return;
    for (const w of windows) {
      if (w.id === 'contracts') this.openContractsWindow();
      if (w.id === 'real-estate') this.openRealEstateWindow();
      if (w.id === 'recruit') this.openRecruitWindow();
      if (w.id === 'project-progress') this.openProjectProgressWindow(true);
      if (w.id === 'completed-projects') this.openCompletedProjectsWindow();
      if (w.id === 'finance') this.openFinanceWindow();
      
      this.wm.setWindowPosition(w.id, w.x, w.y);
    }
  }

  public openProjectProgressWindow(forceOpen: boolean = false) {
    if (forceOpen && this.wm.hasWindow('project-progress')) {
      this.updateProjectProgressWindow();
      return;
    }
    const createFn = () => {
      this.wm.createWindow({
        id: 'project-progress',
        title: 'Projet Actuel',
        x: 50,
        y: 200,
        width: 300,
        contentHtml: this.getProjectProgressHtml()
      });
    };
    if (forceOpen) {
      createFn();
    } else {
      this.toggleWindow('project-progress', createFn);
    }
  }

  public updateProjectProgressWindow() {
    if (document.getElementById('win-project-progress')) {
      this.wm.updateWindowContent('project-progress', this.getProjectProgressHtml());
    }
  }

  private getProjectProgressHtml(): string {
    if (GameState.activeProjects.length === 0) {
      return `<div style="padding: 10px; font-size: 24px; text-align: center;">
                <p><strong>Aucun projet en cours.</strong></p>
                <p style="color: #555; font-size: 18px;">Ouvrez le menu <strong>Contrats</strong> pour en accepter un nouveau !</p>
              </div>`;
    }

    let html = `<div style="font-size: 24px; padding-bottom: 8px;">
                <p style="margin-bottom: 8px; font-style: italic; font-size: 18px; color: #555;">(Le projet n'avance que si vous êtes à votre bureau)</p>`;

    for (const proj of GameState.activeProjects) {
      const p = proj.progress;
      const pctFe = p.totalFe > 0 ? Math.floor((p.fe / p.totalFe) * 100) : 100;
      const pctBe = p.totalBe > 0 ? Math.floor((p.be / p.totalBe) * 100) : 100;
      const pctDes = p.totalDes > 0 ? Math.floor((p.des / p.totalDes) * 100) : 100;
      
      const isUrgent = proj.deadlineDay - GameState.day <= 1;
      const deadlineColor = isUrgent ? '#e74c3c' : '#27ae60';

      html += `
        <div style="border: 1px solid #bdc3c7; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.5);">
          <strong style="display: block; margin-bottom: 4px; color: #000080;">${proj.title}</strong>
          <div style="font-size: 18px; color: ${deadlineColor}; margin-bottom: 6px;">
            <strong>Deadline: Jour ${proj.deadlineDay}</strong>
          </div>
          <div style="margin-bottom: 4px;">
            <span>Frontend (${pctFe}%)</span>
            <div class="progress-container" style="height: 10px; background: #bdc3c7; border: 1px solid #7f8c8d; margin-top: 2px;">
              <div class="progress-bar" style="width: ${pctFe}%; background: #2980b9;"></div>
            </div>
          </div>
          <div style="margin-bottom: 4px;">
            <span>Backend (${pctBe}%)</span>
            <div class="progress-container" style="height: 10px; background: #bdc3c7; border: 1px solid #7f8c8d; margin-top: 2px;">
              <div class="progress-bar" style="width: ${pctBe}%; background: #27ae60;"></div>
            </div>
          </div>
          <div style="margin-bottom: 4px;">
            <span>Design (${pctDes}%)</span>
            <div class="progress-container" style="height: 10px; background: #bdc3c7; border: 1px solid #7f8c8d; margin-top: 2px;">
              <div class="progress-bar" style="width: ${pctDes}%; background: #8e44ad;"></div>
            </div>
          </div>
        </div>
      `;
    }
    
    html += `</div>`;
    return html;
  }

  public openCompletedProjectsWindow() {
    this.toggleWindow('completed-projects', () => {
      this.wm.createWindow({
        id: 'completed-projects',
        title: 'Projets Réalisés',
        x: 100,
        y: 150,
        width: 350,
        contentHtml: this.getCompletedProjectsHtml()
      });
    });
  }

  private getCompletedProjectsHtml(): string {
    const projects = GameState.completedProjects;
    
    if (projects.length === 0) {
      return `<div style="padding: 10px; font-size: 24px; text-align: center;">
                <p><strong>Aucun projet terminé.</strong></p>
                <p style="color: #555; font-size: 18px;">Vos projets livrés apparaîtront ici.</p>
              </div>`;
    }

    let listHtml = '<ul style="list-style:none; padding:0; margin:0; font-size:20px; max-height:300px; overflow-y:auto; border:1px solid #ccc; background:rgba(255,255,255,0.7);">';
    
    for (const p of projects) {
      listHtml += `
        <li style="border-bottom:1px dashed #999; padding:6px;">
          <strong style="color: #000080;">${p.title}</strong>
          <div style="font-size: 16px; color: #555;">Prochain patch: Jour ${p.nextPatchDay}</div>
          <div style="font-size: 16px; color: #27ae60;">Budget gagné: $${p.budget}</div>
        </li>
      `;
    }
    
    listHtml += '</ul>';

    return `
      <div style="font-size: 24px; padding-bottom: 8px;">
        <p style="margin-bottom: 8px; font-style: italic; font-size: 18px; color: #555;">Historique de vos livraisons :</p>
        ${listHtml}
      </div>
    `;
  }

  private initNeedsOverlay() {
    const uiLayer = document.getElementById('ui-layer')!;
    const overlay = document.createElement('div');
    overlay.id = 'needs-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '10px';
    overlay.style.right = '10px';
    overlay.style.width = '250px';
    overlay.style.padding = '10px';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    overlay.style.borderRadius = '4px';
    overlay.style.color = '#fff';
    overlay.style.pointerEvents = 'none'; // Click through
    overlay.style.zIndex = '1000';
    uiLayer.appendChild(overlay);
    this.updateNeedsOverlay();
  }

  public updateNeedsOverlay() {
    const overlay = document.getElementById('needs-overlay');
    if (overlay) {
      overlay.innerHTML = this.getNeedsHtml();
    }
  }

  private getNeedsHtml(): string {
    const n = GameState.needs;
    const getColor = (val: number) => val > 50 ? '#27ae60' : val > 20 ? '#f39c12' : '#c0392b';
    // Pour la vessie, le vert est à 0 et le rouge à 100.
    const getBladderColor = (val: number) => val < 50 ? '#27ae60' : val < 80 ? '#f39c12' : '#c0392b';
    const c = Math.floor(GameState.concentration);
    
    return `
      <div style="font-size: 20px;">
        <div style="margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 6px;">
          <strong style="color: ${getColor(c)}; text-shadow: 1px 1px 0 #000;">🧠 Concentration: ${c}%</strong>
        </div>

        <div style="margin-bottom: 4px;">
          <span style="text-shadow: 1px 1px 0 #000;">💤 Fatigue (${Math.floor(n.energy)}%)</span>
          <div class="progress-container" style="height: 12px; background: rgba(255,255,255,0.2); border: 1px solid #000; margin-top: 2px;">
            <div class="progress-bar" style="width: ${n.energy}%; background: ${getColor(n.energy)};"></div>
          </div>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="text-shadow: 1px 1px 0 #000;">🍔 Faim (${Math.floor(n.hunger)}%)</span>
          <div class="progress-container" style="height: 12px; background: rgba(255,255,255,0.2); border: 1px solid #000; margin-top: 2px;">
            <div class="progress-bar" style="width: ${n.hunger}%; background: ${getColor(n.hunger)};"></div>
          </div>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="text-shadow: 1px 1px 0 #000;">💧 Soif (${Math.floor(n.thirst)}%)</span>
          <div class="progress-container" style="height: 12px; background: rgba(255,255,255,0.2); border: 1px solid #000; margin-top: 2px;">
            <div class="progress-bar" style="width: ${n.thirst}%; background: ${getColor(n.thirst)};"></div>
          </div>
        </div>
        <div style="margin-bottom: 4px;">
          <span style="text-shadow: 1px 1px 0 #000;">🚽 Vessie (${Math.floor(n.bladder)}%)</span>
          <div class="progress-container" style="height: 12px; background: rgba(255,255,255,0.2); border: 1px solid #000; margin-top: 2px;">
            <div class="progress-bar" style="width: ${n.bladder}%; background: ${getBladderColor(n.bladder)};"></div>
          </div>
        </div>
      </div>
    `;
  }

  private initStatsOverlay() {
    const uiLayer = document.getElementById('ui-layer')!;
    const overlay = document.createElement('div');
    overlay.id = 'stats-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '280px'; // Sous les besoins
    overlay.style.right = '10px'; // A droite comme les besoins
    overlay.style.width = '250px';
    overlay.style.padding = '10px';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.border = '2px solid rgba(255, 255, 255, 0.2)';
    overlay.style.borderRadius = '4px';
    overlay.style.color = '#fff';
    overlay.style.pointerEvents = 'none'; // Click through
    overlay.style.zIndex = '1000';
    uiLayer.appendChild(overlay);
    this.updateStatsOverlay();
  }

  public updateStatsOverlay() {
    const overlay = document.getElementById('stats-overlay');
    if (overlay) {
      overlay.innerHTML = this.getStatsHtml();
    }
    
    // Mettre à jour l'heure de la taskbar
    const timeDisplay = document.getElementById('taskbar-time');
    if (timeDisplay) {
      timeDisplay.innerText = this.getFormattedTime();
    }
  }

  public openFinanceWindow() {
    this.toggleWindow('finance', () => {
      this.wm.createWindow({
        id: 'finance',
        title: 'Historique Financier (7 jours)',
        x: 150,
        y: 250,
        width: 450,
        contentHtml: this.getFinanceHtml()
      });
    });
  }

  public updateFinanceWindow() {
    if (this.wm.hasWindow('finance')) {
      this.wm.updateWindowContent('finance', this.getFinanceHtml());
    }
  }

  private getFinanceHtml(): string {
    const cutoffDay = Math.max(1, GameState.day - 7);
    const recentTx = GameState.transactions.filter(t => t.day >= cutoffDay).reverse();
    
    let totalIn = 0;
    let totalOut = 0;
    
    let listHtml = '<ul style="list-style:none; padding:0; margin:0; font-size:18px; max-height:180px; overflow-y:auto; border:1px solid #ccc; background:rgba(255,255,255,0.7);">';
    
    if (recentTx.length === 0) {
      listHtml += '<li style="padding: 4px; text-align: center; color: #555;">Aucune transaction récente.</li>';
    } else {
      for (const t of recentTx) {
        if (t.type === 'income') totalIn += t.amount;
        else totalOut += t.amount;
        
        const color = t.type === 'income' ? '#27ae60' : '#c0392b';
        const sign = t.type === 'income' ? '+' : '-';
        listHtml += `
          <li style="border-bottom:1px dashed #999; padding:4px;">
            <span style="font-weight:bold; color:${color}; float:right;">${sign}$${t.amount}</span>
            <span style="color:#333; font-size:20px;">(Jour ${t.day})</span> ${t.description}
          </li>
        `;
      }
    }
    listHtml += '</ul>';

    const netProfit = totalIn - totalOut;
    const netColor = netProfit >= 0 ? '#27ae60' : '#c0392b';

    return `
      <div style="font-size: 24px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:8px; border-bottom:1px solid #999; padding-bottom:4px;">
          <div><strong style="color:#27ae60;">Entrées:</strong> $${totalIn}</div>
          <div><strong style="color:#c0392b;">Sorties:</strong> $${totalOut}</div>
        </div>
        <div style="margin-bottom:8px; text-align:center;">
          <strong>Bilan 7 derniers jours :</strong> <span style="color:${netColor}; font-weight:bold;">${netProfit >= 0 ? '+' : ''}$${netProfit}</span>
        </div>
        ${listHtml}
      </div>
    `;
  }

  public openRealEstateWindow() {
    this.toggleWindow('real-estate', () => {
      this.wm.createWindow({
        id: 'real-estate',
        title: 'Gestion des Locaux',
        x: 100,
        y: 100,
        width: 450,
        contentHtml: this.getRealEstateHtml()
      });
    });
  }

  public renderRealEstate() {
    this.wm.updateWindowContent('real-estate', this.getRealEstateHtml());
  }

  private getRealEstateHtml(): string {
    let html = `<div style="font-size: 24px;">`;
    if (GameState.officeLevel === 1) {
      html += `<p><strong>Local actuel :</strong> Garage (Niveau 1)</p>
               <p><strong>Bureaux :</strong> 1 / 1</p>
               <p>Il fait sombre et humide. Vous ne pouvez pas recruter ici.</p>
               <button class="os-btn" style="margin-top:8px; width: 100%;" onclick="window.upgradeOffice()">Déménager dans un vrai bureau ($2000)</button>`;
    } else if (GameState.officeLevel === 2) {
      html += `<p><strong>Local actuel :</strong> Agence (Niveau 2)</p>
               <p><strong>Bureaux :</strong> ${GameState.deskCount} / 6</p>
               <p>Vos locaux flambant neufs. Vous pouvez acheter des bureaux (box) pour vos futurs employés.</p>`;
      if (GameState.deskCount < 6) {
        html += `<button class="os-btn" style="margin-top:8px; width: 100%;" onclick="window.buyDesk()">Ajouter un Box / Bureau ($1000)</button>`;
      } else {
        html += `<p style="color: #f39c12; font-weight: bold;">Espace au complet pour l'Agence.</p>
                 <button class="os-btn" style="margin-top:8px; width: 100%; background: #8e44ad; color: white;" onclick="window.upgradeToOpenSpace()">Agrandir (Open Space) ($5000)</button>`;
      }
    } else {
      const maxDesks = 1 + GameState.openSpaceBlocks * 6;
      html += `<p><strong>Local actuel :</strong> Grand Open Space (Niveau 3)</p>
               <p><strong>Bureaux :</strong> ${GameState.deskCount} / ${maxDesks}</p>
               <p><strong>Pôles débloqués :</strong> ${GameState.purchasedPoles.length}</p>
               <p>Un immense espace extensible. Affectez vos équipes dans les différents pôles !</p>`;
      if (GameState.deskCount < maxDesks) {
        html += `<button class="os-btn" style="margin-top:8px; width: 100%;" onclick="window.buyDesk()">Ajouter un Box / Bureau ($1000)</button>`;
      }
      
      const polesInfo = [
        { id: 'finance', name: 'Pôle Finance', cost: 10000, desc: 'Optimise vos revenus' },
        { id: 'datacenter', name: 'Datacenter', cost: 15000, desc: 'Héberge vos propres serveurs' },
        { id: 'recherche', name: 'Pôle Recherche', cost: 20000, desc: 'Innove dans de nouvelles technos' },
        { id: 'universite', name: 'Université', cost: 30000, desc: 'Permet de recruter un Professeur et de former des étudiants gratuitement' }
      ];

      polesInfo.forEach(pole => {
        if (!GameState.purchasedPoles.includes(pole.id)) {
          html += `<button class="os-btn" style="margin-top:8px; width: 100%; background: #3498db; color: white;" onclick="window.buyPole('${pole.id}')">Acheter le ${pole.name} ($${pole.cost})</button>`;
        }
      });
      
      html += `<button class="os-btn" style="margin-top:8px; width: 100%; background: #9b59b6; color: white;" onclick="window.openAssignDesksWindow()">Affecter les employés</button>`;
    }
    html += `</div>`;
    return html;
  }

  public openAssignDesksWindow() {
    this.toggleWindow('assign-desks', () => {
      this.wm.createWindow({
        id: 'assign-desks',
        title: 'Affectation des Bureaux',
        x: 150,
        y: 150,
        width: 400,
        contentHtml: this.getAssignDesksHtml()
      });
    });
  }

  public renderAssignDesks() {
    if (this.wm.hasWindow('assign-desks')) {
      this.wm.updateWindowContent('assign-desks', this.getAssignDesksHtml());
    }
  }

  private getAssignDesksHtml(): string {
    let html = `<div style="font-size: 20px; max-height: 400px; overflow-y: auto;">
      <p>Assignez vos employés à un pôle (1 pôle = 6 bureaux max).</p>
      <ul style="list-style:none; padding:0; margin:0;">`;
      
    const blockNames = ['Open Space Principal'];
    GameState.purchasedPoles.forEach(p => {
      if (p === 'finance') blockNames.push('Pôle Finance');
      else if (p === 'datacenter') blockNames.push('Datacenter');
      else if (p === 'recherche') blockNames.push('Pôle Recherche');
      else if (p === 'universite') blockNames.push('Université');
      else blockNames.push(p);
    });
      
    for (const [eid, info] of GameState.employeesInfo.entries()) {
      const currentBlock = Math.ceil(info.deskIndex / 6);
      html += `
        <li style="border-bottom:1px solid #ccc; padding-bottom:8px; margin-bottom:8px;">
          <strong>${info.title}</strong><br/>
          Pôle actuel : ${blockNames[currentBlock - 1] || 'Inconnu'}<br/>
          <select id="select-block-${eid}" style="font-size:18px; margin-top: 4px;">`;
          for (let b = 1; b <= GameState.openSpaceBlocks; b++) {
            html += `<option value="${b}" ${currentBlock === b ? 'selected' : ''}>${blockNames[b - 1]}</option>`;
          }
      html += `</select>
          <button class="os-btn" onclick="window.assignEmployeeToBlock(${eid}, document.getElementById('select-block-${eid}').value)">Déplacer</button>
        </li>
      `;
    }
    html += `</ul></div>`;
    return html;
  }

  public openAssistantWindow() {
    this.toggleWindow('assistant', () => {
      this.wm.createWindow({
        id: 'assistant',
        title: 'Assistant(e) de Direction',
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150,
        width: 400,
        contentHtml: this.getAssistantHtml()
      });
    });
  }

  public renderAssistant() {
    if (this.wm.hasWindow('assistant')) {
      this.wm.updateWindowContent('assistant', this.getAssistantHtml());
    }
  }

  private getAssistantHtml(): string {
    if (!GameState.hasAssistant) {
      return `<div style="font-size: 20px; max-height: 400px; overflow-y: auto; text-align: center;">
        <p style="margin-top: 0; font-size: 24px; color: #2980b9;"><strong>Bureau de l'Assistant(e)</strong></p>
        <p style="color: #555; margin-bottom: 20px;">Ce bureau est actuellement vide.</p>
        <div style="border: 1px solid #ccc; padding: 15px; text-align: left; margin-bottom: 20px; background: rgba(255,255,255,0.5);">
          <p style="margin-top: 0;">Un(e) assistant(e) de direction peut grandement vous aider à gérer vos locaux :</p>
          <ul style="margin-bottom: 0;">
            <li>Organiser des événements d'équipe (restaure le moral et les besoins)</li>
            <li>Faire appel à des services de nettoyage</li>
            <li>Acheter des équipements spéciaux pour l'entreprise (Double écrans, Machine à café Premium...)</li>
          </ul>
        </div>
        <button class="os-btn" style="width: 100%; font-size: 20px; padding: 10px; background: #27ae60; color: white;" onclick="window.recruitAssistant()">
          Recruter un(e) Assistant(e) ($2000)
        </button>
      </div>`;
    }

    let html = `<div style="font-size: 20px; max-height: 400px; overflow-y: auto;">
      <p style="margin-top: 0;">"Bonjour Patron ! Que puis-je faire pour vous aujourd'hui ?"</p>
      
      <div style="border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; background: rgba(255,255,255,0.5);">
        <strong style="color: #2980b9;">Organiser un repas d'équipe ($1500)</strong>
        <p style="font-size: 16px; margin: 4px 0;">Restaure complètement la faim, la soif et le moral de tout le monde !</p>
        <button class="os-btn" style="width: 100%;" onclick="window.assistantTeamBuilding()">Organiser</button>
      </div>
      
      <div style="border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; background: rgba(255,255,255,0.5);">
        <strong style="color: #2980b9;">Faire appel à une entreprise de nettoyage ($500)</strong>
        <p style="font-size: 16px; margin: 4px 0;">Nettoie immédiatement tout l'Open Space de fond en comble.</p>
        <button class="os-btn" style="width: 100%;" onclick="window.assistantCleanOffice()">Nettoyer</button>
      </div>`;

    if (!GameState.hasDoubleScreens) {
      html += `
      <div style="border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; background: rgba(255,255,255,0.5);">
        <strong style="color: #8e44ad;">Équiper tout le monde d'un double écran ($5000)</strong>
        <p style="font-size: 16px; margin: 4px 0;">Améliore le confort visuel de toute l'équipe (Permanent).</p>
        <button class="os-btn" style="width: 100%; background: #8e44ad; color: white;" onclick="window.assistantBuyDoubleScreens()">Acheter</button>
      </div>`;
    }

    if (!GameState.hasPremiumCoffee) {
      html += `
      <div style="border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; background: rgba(255,255,255,0.5);">
        <strong style="color: #8e44ad;">Machine à café Premium ($3000)</strong>
        <p style="font-size: 16px; margin: 4px 0;">L'équipe se fatiguera un peu moins vite. (Permanent)</p>
        <button class="os-btn" style="width: 100%; background: #8e44ad; color: white;" onclick="window.assistantBuyCoffee()">Acheter</button>
      </div>`;
    }

    if (!GameState.hasTrashCans) {
      html += `
      <div style="border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; background: rgba(255,255,255,0.5);">
        <strong style="color: #8e44ad;">Installer des poubelles individuelles ($1000)</strong>
        <p style="font-size: 16px; margin: 4px 0;">L'agent d'entretien vide les poubelles la nuit. Les locaux se salissent moins vite. (Permanent)</p>
        <button class="os-btn" style="width: 100%; background: #8e44ad; color: white;" onclick="window.assistantBuyTrashCans()">Acheter</button>
      </div>`;
    }

    html += `</div>`;
    return html;
  }

  public openOpsWindow() {
    this.toggleWindow('ops_director', () => {
      this.wm.createWindow({
        id: 'ops_director',
        title: 'Directeur des Opérations',
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150,
        width: 400,
        contentHtml: this.getOpsHtml()
      });
    });
  }

  public renderOpsWindow() {
    if (this.wm.hasWindow('ops_director')) {
      this.wm.updateWindowContent('ops_director', this.getOpsHtml());
    }
  }

  private getOpsHtml(): string {
    if (!GameState.hasOperationsDirector) {
      return `<div style="font-size: 20px; max-height: 400px; overflow-y: auto; text-align: center;">
        <p style="margin-top: 0; font-size: 24px; color: #27ae60;"><strong>Directeur des Opérations</strong></p>
        <p style="color: #555; margin-bottom: 20px;">Ce poste est actuellement vacant.</p>
        <div style="border: 1px solid #ccc; padding: 15px; text-align: left; margin-bottom: 20px; background: rgba(255,255,255,0.5);">
          <p style="margin-top: 0;">Un Directeur des Opérations gère l'équipe de production :</p>
          <ul style="margin-bottom: 0;">
            <li>Augmente drastiquement la limite de projets simultanés (+10)</li>
            <li>Coordonne le travail de vos Chefs de Projets</li>
          </ul>
        </div>
        <button class="os-btn" style="width: 100%; font-size: 20px; padding: 10px; background: #27ae60; color: white;" onclick="window.recruitOpsDirector()">
          Recruter le Directeur ($10000)
        </button>
      </div>`;
    }

    return `<div style="font-size: 20px; max-height: 400px; overflow-y: auto; text-align: center;">
      <p style="margin-top: 0;">"Tout est sous contrôle. Les équipes tournent à plein régime."</p>
      <div style="border: 1px solid #ccc; padding: 15px; text-align: left; margin-bottom: 20px; background: rgba(255,255,255,0.5);">
        <strong style="color: #27ae60;">Bonus Actif</strong>
        <p>Limite de projets simultanés augmentée de +10 !</p>
      </div>
    </div>`;
  }

  public openSalesDirWindow() {
    this.toggleWindow('sales_director', () => {
      this.wm.createWindow({
        id: 'sales_director',
        title: 'Directeur Commercial',
        x: window.innerWidth / 2 - 200,
        y: window.innerHeight / 2 - 150,
        width: 400,
        contentHtml: this.getSalesDirHtml()
      });
    });
  }

  public renderSalesDirWindow() {
    if (this.wm.hasWindow('sales_director')) {
      this.wm.updateWindowContent('sales_director', this.getSalesDirHtml());
    }
  }

  private getSalesDirHtml(): string {
    if (!GameState.hasSalesDirector) {
      return `<div style="font-size: 20px; max-height: 400px; overflow-y: auto; text-align: center;">
        <p style="margin-top: 0; font-size: 24px; color: #3498db;"><strong>Directeur Commercial</strong></p>
        <p style="color: #555; margin-bottom: 20px;">Ce poste est actuellement vacant.</p>
        <div style="border: 1px solid #ccc; padding: 15px; text-align: left; margin-bottom: 20px; background: rgba(255,255,255,0.5);">
          <p style="margin-top: 0;">Un Directeur Commercial gère la recherche de contrats :</p>
          <ul style="margin-bottom: 0;">
            <li>Accepte automatiquement les nouveaux contrats disponibles jusqu'à atteindre votre limite de projets.</li>
            <li>Vous n'aurez plus jamais à cliquer sur le Freelance Board !</li>
          </ul>
        </div>
        <button class="os-btn" style="width: 100%; font-size: 20px; padding: 10px; background: #3498db; color: white;" onclick="window.recruitSalesDirector()">
          Recruter le Directeur ($10000)
        </button>
      </div>`;
    }

    return `<div style="font-size: 20px; max-height: 400px; overflow-y: auto; text-align: center;">
      <p style="margin-top: 0;">"L'argent rentre à flots. Je m'occupe de signer les contrats, vous occupez-vous de livrer le code."</p>
      <div style="border: 1px solid #ccc; padding: 15px; text-align: left; margin-bottom: 20px; background: rgba(255,255,255,0.5);">
        <strong style="color: #3498db;">Bonus Actif</strong>
        <p>Acceptation automatique des contrats du Freelance Board.</p>
      </div>
    </div>`;
  }

  public openCleanerMenu() {
    if (this.wm.hasWindow('cleaner')) {
      this.wm.closeWindow('cleaner');
      return;
    }
    
    let html = '';
    if (GameState.hasCleaner) {
      html = `<div style="text-align: center; padding: 10px;">
        <p>Votre agent d'entretien est déjà en fonction. Il vient nettoyer tous les soirs !</p>
      </div>`;
    } else {
      html = `
        <div style="padding: 10px;">
          <p>L'agent d'entretien nettoie automatiquement l'agence toutes les nuits.</p>
          <p><strong>Coût :</strong> $400 à l'embauche, puis $200 par semaine.</p>
          <button class="os-btn" style="width: 100%; font-size: 18px; padding: 10px; background: #3498db; color: white;" onclick="window.recruitCleaner()">
            Engager l'Agent d'entretien ($400)
          </button>
        </div>
      `;
    }
    
    this.wm.createWindow({
      id: 'cleaner',
      title: 'Station de Nettoyage',
      x: window.innerWidth / 2 - 150,
      y: window.innerHeight / 2 - 100,
      width: 300,
      contentHtml: html
    });
  }

  public showDialog(title: string, message: string) {
    const dialogId = 'dialog-' + Date.now();
    this.wm.createWindow({
      id: dialogId,
      title: title,
      x: window.innerWidth / 2 - 150,
      y: window.innerHeight / 2 - 75,
      width: 300,
      contentHtml: `
        <div style="text-align: center; padding: 10px;">
          <p>${message}</p>
          <button class="os-btn" style="margin-top: 15px;" onclick="window.closeDialog('${dialogId}')">OK</button>
        </div>
      `
    });
  }

  public showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const uiLayer = document.getElementById('ui-layer');
    if (!uiLayer) return;

    const toast = document.createElement('div');
    toast.className = 'window'; // On réutilise le style global des fenêtres
    toast.style.position = 'absolute';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.width = '250px';
    toast.style.padding = '10px';
    toast.style.zIndex = '9999';
    toast.style.transition = 'opacity 0.5s ease-out';
    toast.style.pointerEvents = 'none';

    let color = '#fff';
    if (type === 'success') color = '#2ecc71';
    if (type === 'error') color = '#e74c3c';
    if (type === 'info') color = '#3498db';

    toast.innerHTML = `
      <div style="border-left: 4px solid ${color}; padding-left: 8px;">
        <strong style="color: ${color};">${type === 'success' ? 'Succès' : type === 'error' ? 'Erreur' : 'Info'}</strong><br/>
        <span style="font-size: 18px;">${message}</span>
      </div>
    `;

    uiLayer.appendChild(toast);

    // Supprimer après 4 secondes
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 500);
    }, 4000);
  }

  private getStatsHtml(): string {
    return `
      <div style="font-size: 20px;">
        <div style="margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 4px;">
          <strong style="color: #3498db; text-shadow: 1px 1px 0 #000;">🏢 Company Stats</strong>
        </div>
        <p style="margin: 4px 0; text-shadow: 1px 1px 0 #000;"><strong>Niveau:</strong> ${GameState.level} (${GameState.xp}/${GameState.xpToNextLevel} XP)</p>
        <p style="margin: 4px 0; text-shadow: 1px 1px 0 #000; color: #2ecc71;"><strong>Argent:</strong> $${GameState.money}</p>
        <p style="margin: 4px 0; text-shadow: 1px 1px 0 #000; color: #f1c40f;"><strong>Réputation:</strong> ${GameState.reputation}</p>
      </div>
    `;
  }

  public openDevWindow() {
    this.toggleWindow('dev_mode', () => {
      this.wm.createWindow({
        id: 'dev_mode',
        title: 'Mode Développeur 🛠',
        x: 50,
        y: 50,
        width: 400,
        contentHtml: this.getDevHtml()
      });
    });
  }

  private getDevHtml(): string {
    return `
      <div style="font-size: 18px; max-height: 400px; overflow-y: auto;">
        <p style="color: #8e44ad; font-weight: bold; margin-top: 0;">Outils de triche et de test</p>
        
        <div style="border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; background: rgba(255,255,255,0.5);">
          <strong style="color: #2ecc71;">Ressources</strong>
          <button class="os-btn" style="width: 100%; margin-top: 5px;" onclick="window.devAddMoney()">+ $500,000</button>
          <button class="os-btn" style="width: 100%; margin-top: 5px;" onclick="window.devMaxNeeds()">Restaurer Besoins (Tous)</button>
        </div>

        <div style="border: 1px solid #ccc; padding: 8px; margin-bottom: 10px; background: rgba(255,255,255,0.5);">
          <strong style="color: #e67e22;">Locaux & Niveaux</strong>
          <button class="os-btn" style="width: 100%; margin-top: 5px;" onclick="window.devSetLevel(1)">Forcer Niveau 1 (Garage)</button>
          <button class="os-btn" style="width: 100%; margin-top: 5px;" onclick="window.devSetLevel(2)">Forcer Niveau 2 (Agence)</button>
          <button class="os-btn" style="width: 100%; margin-top: 5px;" onclick="window.devSetLevel(3)">Forcer Niveau 3 (Open Space)</button>
          <button class="os-btn" style="width: 100%; margin-top: 5px; background-color: #8e44ad; color: white;" onclick="window.devUnlockPoles()">Tout débloquer (Niveau 3)</button>
        </div>
        
        <p style="font-size: 14px; color: #7f8c8d; font-style: italic; margin-bottom: 0;">Attention: Changer de niveau brutalement peut causer des bugs visuels mineurs avec les PNJ. Ils se réinitialiseront.</p>
      </div>
    `;
  }
}

