const SOUND_MANAGER = {
    context: false,
    sounds: {},
    audios: {},
    freqPlaying: [],
    soundscustomvolume: {},
    soundsdelta: {},
    globalVolume: 1,
    copySound: function (originId, ...targetIds) {
        let originSound = this.sounds[originId];
        if (!originSound) {
            console.log("Attempted to copy " + originId + ", but no sound is linked !");
            return false;
        }
        for (let target of targetIds) {
            this.sounds[target] = originSound;
            console.log('Copied ' + originId + " to " + target + " !");
        }
        return true;
    },
    registerSound: function (id, url, customVolume = false) {
        let xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        let refThis = this;
        xhr.onload = function () {
            refThis.context.decodeAudioData(xhr.response, function (buffer) {
                if (typeof id === "string") {
                    id = [id];
                }
                for (let tid of id) {
                    refThis.sounds[tid] = buffer;
                    refThis.audios[tid] = [];
                    if (customVolume) {
                        refThis.soundscustomvolume[tid] = customVolume;
                    }
                }
                //console.log("Registered sound " + id + " !");
            }, err => {
                console.error('Unable to register ' + id + '(' + url + '): ', err);
            });
        };
        xhr.send();
    },
    playSound: function (id, vol = 1, pitch = 1, onend = false, onnearend = false, prespitch=false) { // Returns true if no sound is linked, meaning should retry later
        let snd = this.sounds[id];
        if (!snd) {
            console.log("Attempted to play " + id + ", but no sound is linked !");
            return false;
        }
        let src = this.context.createBufferSource();
        src.buffer = snd;
        // src.playbackRate.value = pitch;
        this.setPitch(id, src, pitch,prespitch);

        // src.connect(this.context.destination);

        let gainNode = this.context.createGain();
        src.connect(gainNode);
        src.gainNode = gainNode;
        gainNode.connect(this.context.destination);
        let cstm = this.soundscustomvolume[id] ? this.soundscustomvolume[id] : 1;
        gainNode.gain.value = this.globalVolume * vol * cstm;
        // console.log('Gain: '+gainNode.gain.value);


        let rthis = this;
        src.onended = () => {
            if (onend && typeof onend == "function") onend();
            let c = 0;
            for (let ad of rthis.audios[id]) {
                if (ad === src) {
                    rthis.audios[id].splice(c, 1);
                }
                c++;
            }
        }
        src.ontimeupdate = () => {
            if (src.currentTime > (src.buffer.duration - .5)) {
                if (onnearend) onnearend();
            }
        }
        src.start(0);
        this.audios[id].push(src);
        return src;
    },
    /**
     * Stops every sound playing on given id, and avoid playing the onend
     * @param id registered ID of the sound
     */
    stopSound: function (id) {
        for (let idd in this.audios) {
            if (idd === id) {
                while (this.audios[id].length > 0) {
                    let a = this.audios[id].shift();
                    a.onended = () => {
                    };
                    a.stop();
                    console.log('stopped '+id)
                }
            }
        }
    },
    stopAllSound: function () {
        for (let idd in this.audios) {
            while (this.audios[idd].length > 0) {
                let a = this.audios[idd].shift();
                a.onended = () => {
                };
                a.stop();
                console.log('stopped '+idd)
            }
        }
    },
    /**
     * Stops every sound playing on given id, but plays the onend
     * @param id registered ID of the sound
     */
    endSound: function (id) {
        for (let idd in this.audios) {
            if (idd === id) {
                while (this.audios[id].length > 0) {
                    let a = this.audios[id].shift();
                    a.stop();
                }
            }
        }
    },
    playFreq: function(hz, vol){
        // vol = Math.min((volRef-vol)/volRef, 1) * (volMult);
        // -3db = /2
        // -6db = /4
        // -9db = /8
        // etc
        let volMult = 2
        vol = 1 / Math.pow(2, (vol)/3);
        if(vol>1){
            console.error("Volume to high ! "+vol);
            return;
        }
        vol *= volMult;

        if(this.freqPlaying[hz]){
            this.freqPlaying[hz].gainNode.gain.value = vol;
            return;
        }

        //console.log(this.context)

        let oscillator = this.context.createOscillator();
        let gainNode = this.context.createGain();
        let convolver = this.context.createConvolver();

        oscillator.type = 'sine';
        oscillator.frequency.value = hz;
        oscillator.connect(gainNode);
        oscillator.gainNode = gainNode;
        oscillator.convolverNode = convolver;

        gainNode.connect(/*convolver*/this.context.destination);
        gainNode.gain.value = vol;

        // convolver.connect(this.context.destination);
        // convolver.gain.value = vol;

        //this.freqPlaying[hz] = oscillator;

        oscillator.start();

        //console.log('bip')
    },
    stopFreq: function(hz){
        if(this.freqPlaying[hz]){
            this.freqPlaying[hz].stop();
            delete this.freqPlaying[hz];
        }
    },
    getPlayingSounds: function (id) {
        for (let idd in this.audios) {
            if (idd === id) {
                return this.audios[idd];
            }
        }
        return false;
    },
    isRegistered: function (id) {
        for (let idd in this.sounds) {
            if (idd === id) {
                return true;
            }
        }
        return false;
    },
    playBlob: async function (blob, volumeImmune = true) {
        let src = this.context.createBufferSource();
        src.buffer = await blob.arrayBuffer();

        let gainNode = this.context.createGain();
        src.connect(gainNode);
        src.gainNode = gainNode;
        gainNode.connect(this.context.destination);
        if (volumeImmune) gainNode.gain.value = this.globalVolume;

        src.start(0);
        return src;
    },
    loopSound: function(id, vol = 1, pitch = 1, prespitch = false){
        if(this.getPlayingSounds(id) && this.getPlayingSounds(id).length >= 1) {
            for(let sound of this.getPlayingSounds(id)){
                sound.gainNode.gain.value = vol;
                this.setPitch(id, sound, pitch, prespitch);
            }
            return;
        }
        let b = ()=>{
            this.playSound(id,vol,pitch,b);
        }
        b();
    },
    setPitch: (name, source, value, preserve=false) =>{
        if((value <0 && !SOUND_MANAGER.soundsdelta[name]) || (value >=0 && !!SOUND_MANAGER.soundsdelta[name])){
            let a = source.buffer;
            Array.prototype.reverse.call( a.getChannelData(0) );
            if(value < 0){
                SOUND_MANAGER.soundsdelta[name]=true;
            }else{
                SOUND_MANAGER.soundsdelta[name]=false;
            }
        }
        source.preservesPitch = true;
        // source.detune = 800;
        source.playbackRate.value = Math.abs(value);
    }
    
}
window.AudioContext = window.AudioContext || window.webkitAudioContext;
SOUND_MANAGER.context = new AudioContext();












let fu = false

let fuTriggered = false

let fuAcq = false
let finFu = false

// Élément audio
const accelerationSound = document.getElementById('audio');

// Paramètres de simulation
let isPlaying = false;

let accelSrc = "ACCEL"

// Fonction pour synchroniser le son avec la vitesse
function updateSoundPosition(speed) {
    if(currentThrottle>0 && accelSrc!=="ACCEL") {
        accelerationSound.src="src/snd/val206/test_mot.mp3";
        accelSrc="ACCEL"
    }
    if(currentThrottle<0 && accelSrc!=="DECEL") {
        accelerationSound.src="src/snd/val206/test_mot_rev.mp3";
        accelSrc="DECEL"
    }
    if(currentSpeed===0) return accelerationSound.pause();
    accelerationSound.play()
  const soundDuration = accelerationSound.duration; // Durée totale du son
  if (!soundDuration) return; // Assurez-vous que le son est chargé

  // Calcul de la position dans l'audio en fonction de la vitesse
  const normalizedSpeed = Math.min(speed / maxSpeed, 0.99); // Normaliser entre 0 et 1
  const targetTime = normalizedSpeed * soundDuration; // Position cible dans le son
  const targetTimeRev = (1-normalizedSpeed) * soundDuration; // Position cible dans le son

  // Ajuster la position du son
  if (Math.abs(accelerationSound.currentTime - targetTime) > 0.1) {
    accelerationSound.currentTime = currentThrottle>0?targetTime:targetTimeRev;
  }
  

  const targetPlayback = Math.abs(currentThrottle/maxThrottle);

  accelerationSound.playbackRate=targetPlayback+0.10
}

// Lecture du son
accelerationSound.addEventListener('canplay', () => {
  if (!isPlaying) {
    accelerationSound.loop = true; // Assurer une lecture continue
    accelerationSound.play();
    isPlaying = true;
  }
});

setInterval(()=>{
    updateSoundPosition(currentSpeed);
},500)

window.updateSounds=()=>{
    


    let vitessePourcent = (currentSpeed*100)/maxSpeed
    let aigFreqThreshold = 24 //valeur de viteesse où la fréquence aigue commence à disparaitre
    let aigFreqVol = 0.5
    let bFreqVol = 0.1
    
    bFreqVol=0.5-aigFreqVol+0.1

    if(fuTriggered===false){
        if(currentSpeed>aigFreqThreshold){
            if(currentSpeed>24) aigFreqVol=0.5
            if(currentSpeed>26) aigFreqVol=0.4
            if(currentSpeed>30) aigFreqVol=0.3
            if(currentSpeed>36) aigFreqVol=0.2
            if(currentSpeed>38) aigFreqVol=0.1
            if(currentSpeed>40) aigFreqVol=0
        }

        if(currentSpeed>0){
            //SOUND_MANAGER.loopSound('hach206',0.5)
            //SOUND_MANAGER.loopSound('hach206base',0.1)
        } else {
            SOUND_MANAGER.stopSound('hach206')
            SOUND_MANAGER.stopSound('hach206bis')
            SOUND_MANAGER.stopSound('hach206ng')
            SOUND_MANAGER.stopSound('hach206all')
        }
    
        if((currentSpeed>0 && !(currentThrottle===0))){
            //! NEW MOT
            /*SOUND_MANAGER.loopSound('hach206',Math.abs(throttlePourcent)/70)
            SOUND_MANAGER.loopSound('hach206all',Math.abs(throttlePourcent)/180+0.15)*/
            //! END NEW MOT
            //console.log(`${Math.abs(throttlePourcent)/180+0.15}`)
            //SOUND_MANAGER.loopSound('hach206ng',0.3)
            //SOUND_MANAGER.loopSound('hach206bis',0.1)
            isPlayingHach=true
        } 
        if (currentSpeed===0 || currentThrottle===0){
            //SOUND_MANAGER.stopSound('hach206')
        }

        if(currentSpeed>0){
            //SOUND_MANAGER.loopSound('mot206',0.5,currentSpeed/20)
            //! NEW MOT <
            /*SOUND_MANAGER.loopSound('mot2061F',Math.min(20/currentSpeed,0.5),currentSpeed/20)*/
            //! > NEW MOT
            //console.log(`${Math.min(20/currentSpeed,0.5)}`)
            //! NEW MOT <
            /*SOUND_MANAGER.loopSound('mot2062F',aigFreqVol,currentSpeed/20)
            SOUND_MANAGER.loopSound('mot2063F',bFreqVol,currentSpeed/20)*/
            //! > NEW MOT

        }
    } else {
        if(currentSpeed===0) fuTriggered=false;

        fuAcq=true
        if(fu===false){
            SOUND_MANAGER.playSound('fuprem206')
            fu=true
        }
        //rangeInput.value=-5
        //currentSpeed += ((-7.5 / 60) * delta);

        //SOUND_MANAGER.stopSound('mot2062F')
        SOUND_MANAGER.stopSound('mot2063F')
        SOUND_MANAGER.stopSound('hach206')
        SOUND_MANAGER.stopSound('hach206ng')
        SOUND_MANAGER.stopSound('hach206all')

        //! NEW MOT <
        /*SOUND_MANAGER.loopSound('mot2061F',0.5,currentSpeed/20)
        SOUND_MANAGER.loopSound('mot2062F',0.2,currentSpeed/20)*/
        //! > NEW MOT

        if(currentSpeed<12 && finFu===false){
            finFu=true
            SOUND_MANAGER.playSound('finfu206',1.5)
        }


        //SOUND_MANAGER.loopSound('mot2063F',bFreqVol,currentSpeed/20)
    }

    if(currentSpeed>0 && fu===true && fuTriggered===false){
        fu=false
        fuAcq=false
        finFu=false
        SOUND_MANAGER.playSound('defu206')
        //SOUND_MANAGER.stopSound('ambiance206')
        //SOUND_MANAGER.stopSound('finHach206')
    } else if (currentSpeed===0 && fu===false && fuAcq===false){
        fu=true
        SOUND_MANAGER.playSound('fu206')
        //SOUND_MANAGER.loopSound('ambiance206')
        SOUND_MANAGER.stopSound('finfu206')
    }

    if(currentSpeed>0){
        //! NEW MOT <
        //SOUND_MANAGER.loopSound('ambBase206',currentSpeed/60,Math.max((currentSpeed/60)-0.3,0.1))
        //! > NEW MOT
        //console.log(`${Math.max((currentSpeed/60)-0.3,0.1)}`)
    }
}







(()=>{
    //SOUND_MANAGER.registerSound('hach206','./snd/val206/hacheur1.mp3')
    SOUND_MANAGER.registerSound('hach206bis','./src/snd/val206/hacheur1.mp3')
    SOUND_MANAGER.registerSound('hach206','./src/snd/val206/hacheureel.mp3')
    SOUND_MANAGER.registerSound('hach206all','./src/snd/val206/hachAig2.mp3')
    SOUND_MANAGER.registerSound('hach206base','./src/snd/val206/hacheur_base.mp3')
    SOUND_MANAGER.registerSound('hach206ng','./src/snd/val206/hacheurng.mp3')
    SOUND_MANAGER.registerSound('ambiance206','./src/snd/val206/ambianceinter.mp3')
    SOUND_MANAGER.registerSound('ambBase206','./src/snd/val206/ambAvecBase.mp3')
    SOUND_MANAGER.registerSound('ambSansBase206','./src/snd/val206/ambSansBase.mp3')
    SOUND_MANAGER.registerSound('finHach206','./src/snd/val206/finHach.mp3')
    SOUND_MANAGER.registerSound('mot206','./src/snd/val206/mot.mp3')
    SOUND_MANAGER.registerSound('mot2061F','./src/snd/val206/mot1F.mp3')
    SOUND_MANAGER.registerSound('mot2062F','./src/snd/val206/mot2F.mp3')
    SOUND_MANAGER.registerSound('mot2063F','./src/snd/val206/mot3F.mp3')

    SOUND_MANAGER.registerSound('fu206','./src/snd/val206/fu-propre.mp3')
    SOUND_MANAGER.registerSound('defu206','./src/snd/val206/de-fu.mp3')
    SOUND_MANAGER.registerSound('fuprem206','./src/snd/val206/fu_prem.mp3')
    SOUND_MANAGER.registerSound('finfu206','./src/snd/val206/finFu.mp3')
    SOUND_MANAGER.registerSound('djht206','./src/snd/val206/djht.mp3')

    SOUND_MANAGER.registerSound('pcc','./src/snd/sim/beep.wav')
})();