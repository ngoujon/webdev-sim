export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  
  public volumes = {
    master: 0.5,
    bgm: 0,
    sfx: 0.5
  };

  constructor() {}

  public init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volumes.master;
    this.masterGain.connect(this.ctx.destination);
    
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.volumes.bgm;
    this.bgmGain.connect(this.masterGain);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.masterGain);
    
    // Démarrer une musique de fond
    this.playAmbientBGM();
  }

  public updateVolumes(master: number, bgm: number, sfx: number) {
    this.volumes = { master, bgm, sfx };
    if (this.masterGain) this.masterGain.gain.value = master;
    if (this.bgmGain) this.bgmGain.gain.value = bgm;
    if (this.sfxGain) this.sfxGain.gain.value = sfx;
  }

  private serverOsc: OscillatorNode | null = null;
  private serverGain: GainNode | null = null;

  public updateServerSoundVolume(distance: number) {
    if (!this.ctx || !this.sfxGain) return;
    
    // Si sfx muté ou distance > 300, on coupe le son
    if (this.volumes.sfx === 0 || distance > 300) {
      if (this.serverGain) {
        this.serverGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      }
      return;
    }
    
    if (!this.serverOsc) {
      this.serverOsc = this.ctx.createOscillator();
      this.serverGain = this.ctx.createGain();
      
      // Bruit de fond de serveur (onde carrée bas-medium pour faire un hum)
      this.serverOsc.type = 'sawtooth';
      this.serverOsc.frequency.value = 55; // Hum bas
      
      this.serverGain.gain.value = 0;
      
      this.serverOsc.connect(this.serverGain);
      this.serverGain.connect(this.sfxGain);
      
      this.serverOsc.start();
    }
    
    // Calcul du volume basé sur la distance (0 proche -> max 0.03, 300 loin -> 0)
    const vol = Math.max(0, 1 - (distance / 300)) * 0.03; // Volume baissé
    this.serverGain?.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);

    // Ajout de petits bips aléatoires typiques d'un serveur quand on est proche
    if (vol > 0 && Math.random() < 0.02 && this.volumes.sfx > 0) {
      const beepOsc = this.ctx.createOscillator();
      const beepGain = this.ctx.createGain();
      
      beepOsc.type = Math.random() > 0.5 ? 'sine' : 'square';
      beepOsc.frequency.value = 1000 + Math.random() * 2000; // Fréquence aigüe (bip)
      
      beepGain.gain.setValueAtTime(vol * 1.5, this.ctx.currentTime); // Le bip ressort un peu par rapport au hum
      beepGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05); // Bip très court
      
      beepOsc.connect(beepGain);
      beepGain.connect(this.sfxGain);
      
      beepOsc.start();
      beepOsc.stop(this.ctx.currentTime + 0.05);
    }
  }
  
  public stopServerSound() {
    if (this.serverGain && this.ctx) {
      this.serverGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    }
  }

  public playClickSound() {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  public playTypingSound() {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const freq = 1000 + Math.random() * 500;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  public playIncomeSound() {
    if (!this.ctx || !this.sfxGain || this.volumes.sfx === 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime); // High pitch start
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime + 0.1); // Higher pitch for "coin" effect

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public playExpenseSound() {
    if (!this.ctx || !this.sfxGain || this.volumes.sfx === 0) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime); // Low pitch
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.2); // Pitch drop

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public playSuccessSound() {
    if (!this.ctx || !this.sfxGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.2); // G5

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.setTargetAtTime(0.3, this.ctx.currentTime + 0.2, 0.1);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  public playActionSound(type: string) {
    if (!this.ctx || !this.sfxGain || this.volumes.sfx === 0) return;
    const now = this.ctx.currentTime;
    
    if (type === 'playing_tennis') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'playing_babyfoot') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400 + Math.random() * 200, now); // Bruit sec (toc)
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'eating') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'reading') {
      // Noise (paper rustle)
      const bufferSize = this.ctx.sampleRate * 0.1; // 0.1 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;
      const gain = this.ctx.createGain();
      // Lowpass filter for softer sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1000;
      
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      
      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      whiteNoise.start(now);
    } else if (type === 'toilet') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100 + Math.random() * 20, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'sleeping') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(60, now + 1.0);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.5);
      gain.gain.linearRampToValueAtTime(0, now + 1.5);
      osc.connect(gain); gain.connect(this.sfxGain);
      osc.start(now); osc.stop(now + 1.5);
    }
  }

  private bgmInterval: number | null = null;
  private currentChordIndex = 0;
  private chillChords = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [174.61, 220.00, 261.63, 329.63], // Fmaj7
    [196.00, 246.94, 293.66, 349.23], // G7
  ];

  private playAmbientBGM() {
    if (!this.ctx || !this.bgmGain) return;
    
    const bpm = 70; // Chill tempo
    const beatDuration = 60 / bpm;
    
    // Play the first chord immediately
    this.playChord(this.chillChords[this.currentChordIndex]);
    
    if (this.bgmInterval !== null) {
      window.clearInterval(this.bgmInterval);
    }

    this.bgmInterval = window.setInterval(() => {
      this.currentChordIndex = (this.currentChordIndex + 1) % this.chillChords.length;
      this.playChord(this.chillChords[this.currentChordIndex]);
    }, beatDuration * 4 * 1000);
  }

  private playChord(frequencies: number[]) {
    if (!this.ctx || !this.bgmGain) return;
    const now = this.ctx.currentTime;
    
    frequencies.forEach((freq, index) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      
      // Bass is sine wave, higher notes are smooth triangles
      osc.type = index === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq / 2; // Lower pitch for a warmer, deeper chill vibe
      
      // Smooth slow attack and long release envelope
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.04, now + 1.0); // Slow attack
      gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5); // Slow release
      
      osc.connect(gain);
      gain.connect(this.bgmGain!);
      
      osc.start(now);
      osc.stop(now + 4);
    });
  }
}

export const audioEngine = new AudioEngine();
