/*
Main file of TorrenTV
*/

var airplayJs    = require('airplay-js'), // JS Native Apple AirPlay client library for AppleTV https://www.npmjs.org/package/airplay-js
    airplayXbmc  = require('airplay-xbmc'), // JS Native AirPlay client library for XBMC https://www.npmjs.org/package/airplay-xbmc
    chromecastjs = require('chromecast-js'); // Chromecast/Googlecast streaming module all in JS https://www.npmjs.org/package/chromecast-js

var readTorrent = require('read-torrent'), // Read and parse a torrent from a resource https://www.npmjs.org/package/read-torrent
    peerflix    = require('peerflix'), // Streaming torrent client for Node.js https://www.npmjs.org/package/peerflix
    numeral     = require('numeral'); // Format and manipulate numbers https://www.npmjs.org/package/numeral

var path        = require('path'),
	connect     = require('connect'),
	address     = require('network-address'),
	serveStatic = require('serve-static'),
	querystring = require('querystring');

var browser = airplayJs.createBrowser(),
    browserXbmc = airplayXbmc.createBrowser(),
    chromecaster = new chromecastjs.Browser();
var port = 4007;
var last_played = '';

//Downloading torrent from link
var http = require('http');
var mu = require('mu2');
var fs = require('fs');

var global_href = "192.168.0.101:8000"

var gui = require('nw.gui');
var emitter = gui.Window.get();
var menu = new gui.Menu();
//menu.removeAt(1);

var isMac = process.platform.indexOf('dar') > -1 || process.platform.indexOf('linux') > -1;
//emitter.resizeTo(300, 320)
if(!isMac){
  emitter.resizeTo(300, 340)
}

var xmlRokuServer = function(){
  var server = http.createServer(function(req, res){
	mu.root = 'src/app/';
    mu.clearCache();
    var stream = mu.compileAndRender('index.xml', {source: global_href});
    stream.pipe(res);
  });

  server.listen(9009);
}

xmlRokuServer();

var device = ""
var devices = []
var movieName = ""
var movieHash = ""
var intervalArr = new Array();
var loading = false;
var loadingPlayer = false;
var ips = []

var doc = document.documentElement;
doc.ondragover = function () { this.className = 'hover'; return false; };
doc.ondragend = function () { this.className = ''; return false; };
doc.ondrop = = function (event) {

  cleanStatus();

  event.preventDefault && event.preventDefault();
  this.className = '';

  var magnet = event.dataTransfer.getData('Text');;
  var new_torrent = ""
  secondaryMessage("")

  if(!magnet.length>0 && event.dataTransfer.files.length >0){
    new_torrent = event.dataTransfer.files[0].path;
    //console.log(new_torrent)

    //Local .torrent file dragged
    if(new_torrent.toLowerCase().substring(new_torrent.length-7,new_torrent.length).indexOf('torrent')>-1){
      if(isMac){
        secondaryMessage(new_torrent.split('/').pop().replace(/\{|\}/g, '').substring(0,30)+"...")
      }else{
        secondaryMessage(new_torrent.split('\\').pop().replace(/\{|\}/g, '').substring(0,30)+"...")
      }
      //console.log(">>>>>>>>>>>>>>>>>>>>>>>>##########")
      //console.log(last_played==new_torrent)
      if(last_played==new_torrent){
        emitter.emit('wantToPlay');
      }else{
        processTorrent(new_torrent)
      }
      last_played = new_torrent

    }else{
      //Not a torrent, could be a local Movie, also send
      if(new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('mp4')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('mov')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('mkv')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('avi')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('m4a')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-4,new_torrent.length).indexOf('flac')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('mp3')>-1){
        showMessage("Sending")

        var dirname = path.dirname(new_torrent)
        var basename = path.basename(new_torrent)
        if(basename.length<15)
          secondaryMessage("Local File: "+basename);
        else
          secondaryMessage("Local File: "+basename.substring(0,15)+"...");

        port++;
        connect().use(serveStatic(dirname)).listen(port);

        var resource = 'http://'+address()+':'+port+'/'+querystring.escape(basename)

        console.log(resource)
        playInDevices(resource)
        /*
        self.devices.forEach(function(dev){
          if(dev.active){
            showMessage("Streaming")
            dev.play(resource, 0, function() {
              console.log(">>> Playing in AirPlay device: "+resource)
              showMessage("Streaming")
              if(dev.togglePlayIcon){
                console.log("Toggling play icon")
                dev.togglePlayIcon()
              }
            });
          }
        });
        */

      }else{
        secondaryMessage("Invalid Filetype")
      }
    }
  }else{
    if(magnet.toLowerCase().substring(0,6).indexOf('magnet')>-1){
      //magnet link
      secondaryMessage("Magnet")
      if(last_played==magnet){
        emitter.emit('wantToPlay');
      }else{
        gotTorrent(magnet);
      }
      last_played = magnet

    }else{
      if(magnet.toLowerCase().substring(0,4).indexOf('http')>-1){
        secondaryMessage("HTTP Link")
        //it's a normal http link
        magnet = magnet.toLowerCase().split("?")[0]
        secondaryMessage(magnet)
        if(magnet.substring(magnet.length-7,magnet.length).indexOf('torrent')>-1){
          secondaryMessage("Downloading .torrent file")
          processTorrent(magnet)
        }else{
          if(self.device){
            self.device.play(href, 0, function() {
              console.log(">>> Playing in AirPlay device: "+href)
              showMessage("URL sent")
            });
          }else{
            secondaryMessage("Not sent")
            showMessage("Could not find any Device")
          }
        }
      }
    }
  }

  return false;
};

var openInFinder = function(file){
  gui.Shell.showItemInFolder(file);
}

var showMessage = function(message){
  document.getElementById('top-message').innerHTML = message
}
var secondaryMessage = function(message){
  document.getElementById('info-message').innerHTML = message
}

var bytes = function(num) {
  return numeral(num).format('0.0b');
};

var statusMessage = function(unchoked,wires,swarm){
  document.getElementById('box-message').innerHTML = "Peers: "+unchoked.length+"/"+wires.length+"</br> Speed: "+bytes(swarm.downloadSpeed())+"/s</br>  Downloaded: "+bytes(swarm.downloaded)
}

var cleanStatus = function(){
  document.getElementById('box-message').innerHTML = ""
}

function processTorrent(new_torrent){
  readTorrent(new_torrent, function(err, torrent) {
    if (err) {
      console.error(err.message);
      process.exit(1);
    }

    //console.log(torrent)
    if(JSON.stringify(torrent.files).toLowerCase().indexOf('mkv')>-1){
      secondaryMessage("<div class='error'>MKV movie format not supported.</div>");
      showMessage("Torrent contains .MKV Movie");
      movieName = torrent.name
      movieHash = torrent.infoHash
      gotTorrent(torrent);
    }else{
      movieName = torrent.name
      movieHash = torrent.infoHash
      gotTorrent(torrent);
    }
  });
}

function playInDevices(resource){
	self.devices.forEach(function(dev){
	  if(dev.active){
		showMessage("Streaming")
		dev.play(resource, 0, function() {
		  self.playingResource = resource
		  console.log(">>> Playing in device: "+resource)
		  showMessage("Streaming")
		  if(dev.togglePlayIcon){
			dev.togglePlayIcon()
			if(dev.playing == false || dev.stopped == true){
				dev.togglePlayIcon()
				console.log("Toggling play icon")
			}
			dev.togglePlayControls();
			if(dev.enabled==false){
			  dev.togglePlayControls()
			}
			dev.playing = true
			dev.enabled = true
			dev.stopped = false
			dev.loadingPlayer = false
		  }
		});
	  }
	});
}

function setUIspace(){
     document.getElementById('airplay').style.width = 50*ips.length+'px';
}

function toggleStop(n){
    if(self.devices[n].enabled==true){
      self.devices[n].player.stop(function(){
        console.log('stoped!');
        self.devices[n].playing = false
        self.devices[n].stopped = true
      });

      if(self.devices[n].playing==true){
        document.getElementById('playbutton'+n).classList.toggle('pausebutton');
      }
  }
}

function togglePlay(n){
    if(self.devices[n].enabled==true){
      if(self.devices[n].playing==true){
          self.devices[n].player.pause(function(){
              console.log('paused!')
              self.devices[n].playing = false
              document.getElementById('playbutton'+n).classList.toggle('pausebutton');
          })
      }else{
          console.log('not paused!')
          if(self.devices[n].stopped == true){
            console.log('seems stopped')
            if(self.devices[n].loadingPlayer != true){
                self.devices[n].loadingPlayer = true
                self.devices[n].play(this.playingResource,0,function(){
                    console.log('telling to play from start again')
                    if(devices[n].togglePlayIcon){
                      console.log("Toggling play icon")
                      self.devices[n].playing = true
                      self.devices[n].stopped = false
                      self.devices[n].togglePlayIcon()
                      self.devices[n].loadingPlayer = false
                    }
                })
            }
          }else{
            self.devices[n].player.play(function(){
                console.log('just go to play!')
                self.devices[n].playing = true
                self.devices[n].stopped = false
                document.getElementById('playbutton'+n).classList.toggle('pausebutton');
            })
         }
      }
  }
}

function seekForward(n, timelapse){
	timelapse = timelapse === undefined ? 30 : timelapse;
	var device = self.devices[n];
	if (device.playing) {
		device.player.seek(timelapse, function(){
              console.log('seek +30')
		});
	}
}

function toggleDevice(n){
    self.devices[n].active = !self.devices[n].active
    document.getElementById('off'+n).classList.toggle('offlabel');
    document.getElementById('airplay-icon'+n).classList.toggle('deviceiconOff');
}

function toggleChromecastDevice(n){
    self.devices[n].active = !self.devices[n].active
    document.getElementById('off'+n).classList.toggle('offlabel');
    //document.getElementById('airplay-icon'+n).classList.toggle('deviceiconOff');

}


function addDeviceElement(label){
     document.getElementById('dropmessage').style.height = '100px';
     document.getElementById('airplay').innerHTML += '<div onclick="toggleDevice('+(ips.length-1)+');" class="device"><img id="airplay-icon'+(ips.length-1)+'" class="deviceicon"/> <p style="margin-top:-10px;">'+label+'</p> <p id="off'+(ips.length-1)+'" class="offlabel" style="margin-top:-60px;">OFF</p> </div>'
     setUIspace()
}

function addChromecastDeviceElement(label){
     document.getElementById('dropmessage').style.height = '100px';
     var htmlDevice = ' <div  class="device" style="margin-top:22px;"> <div class="chromecontrols"> <div id="playbutton'+(ips.length-1)+'" class="controlbutton hidden" onclick="togglePlay('+(ips.length-1)+');"><img class="playbutton"/></div> <div id="stopbutton'+(ips.length-1)+'"class="controlbutton hidden" onclick="toggleStop('+(ips.length-1)+');"><img class="stopbutton"/></div> <div id="seekbutton'+(ips.length-1)+'"class="controlbutton hidden" onclick="seekForward('+(ips.length-1)+');"><img class="seekbutton"/></div> </div><img onclick="toggleChromecastDevice('+(ips.length-1)+');" id="airplay-icon'+(ips.length-1)+'" class="chromeicon"/> <p style="margin-top:-3px;">'+label+'</p> <div onclick="toggleChromecastDevice('+(ips.length-1)+');"><p id="off'+(ips.length-1)+'" class="offlabel" style="margin-top:-36px;margin-left:-8px;" >OFF</p> </div></div> </div>'

     document.getElementById('airplay').innerHTML += htmlDevice
     setUIspace()
}

chromecaster.on( 'deviceOn', function( device ) {
   console.log(device)
   if(ips.indexOf(device.config.addresses[0])<0){
     ips.push(device.config.addresses[0])
     var name = device.config.name.substring(0,7)+ (device.config.name.length > 7 ? "..." : "")
     addChromecastDeviceElement(name)
     device.active       = true
     device.enabled      = false
     device.playerButton = true
     device.stopped      = false
     device.playerButtonHtml = document.getElementById('playbutton'+(ips.length-1)).classList
     device.stopButtonHtml = document.getElementById('stopbutton'+(ips.length-1)).classList
	 device.seekButtonHtml = document.getElementById('seekbutton'+(ips.length-1)).classList
     device.togglePlayIcon = function(){
         device.playerButtonHtml.toggle('pausebutton');
     }
     device.togglePlayControls = function(){
         device.playerButtonHtml.toggle('hidden');
         device.stopButtonHtml.toggle('hidden');
		 device.seekButtonHtml.toggle('hidden');
     }
     self.devices.push(device)
     emitter.emit('wantToPlay');
   }
});

browser.on( 'deviceOn', function( device ) {
   if(ips.indexOf(device.info[0])<0){
     ips.push(device.info[0])
     console.log(ips)
     var name = device.name.substring(0,7)+ (device.name.length > 7 ? "..." : "")
     //var name = device.name
     addDeviceElement(name)
     device.active = true
     console.log("Device found!", device)
     self.devices.push(device)
     //console.log('tryToPlay')
     emitter.emit('wantToPlay');
  }
});

browser.start();

browserXbmc.on( 'deviceOn', function( device ) {
   if(ips.indexOf(device.info[0])<0){
     ips.push(device.info[0])
     console.log(ips)
     var name = device.name.substring(0,7)+ (device.name.length > 7 ? "..." : "")
     addDeviceElement(name)
     
     device.active = true
     console.log("XBMC found!", device)
     self.devices.push(device)
     //console.log('tryToPlay')
     emitter.emit('wantToPlay');
   }
});

browserXbmc.start();


function killIntervals(){
  //console.log("Killing all intervals");
  while(intervalArr.length > 0)
      clearInterval(intervalArr.pop());
};

var gotTorrent = function(this_torrent){

   killIntervals();

   showMessage("Processing Torrent")

   if(!loading){
     document.getElementById('arrow').classList.toggle('visible');
     document.getElementById('arrow').classList.toggle('hidden');
     document.getElementById('processing').classList.toggle('processing-icon');
   }
   loading = true

  var engine = peerflix(this_torrent, {});
  //engine.swarm.piecesGot = 0

  var hotswaps = 0;
  var verified = 0;
  var invalid = 0;

  var wires = engine.swarm.wires;
  var swarm = engine.swarm;

  var active = function(wire) {
    //console.log("peerChoking")
    return !wire.peerChoking;
  };

  engine.on('verify', function() {
    //console.log('verify')
    verified++;
    engine.swarm.piecesGot += 1;
  });

  engine.on('invalid-piece', function() {
    //console.log('invalidpiece')
    invalid++;
  });

  // remove peerflix files upon exit
  var window = gui.Window.get();
  window.on('close', function() {
    engine.remove(function(){
      gui.App.quit();
    });
  });

  var onready = function() {
    console.log('We are ready')
  };
  if (engine.torrent) onready();
  else engine.on('ready', onready);

  engine.on('hotswap', function() {
    //console.log('hotswap')
    hotswaps++;
  });

  engine.server.on('listening', function() {
    console.log('Streaming server is listening')
    var href = 'http://'+address()+':'+engine.server.address().port+'/';
    global_href = href
    var filename = engine.server.index.name.split('/').pop().replace(/\{|\}/g, '');
    var filelength = engine.server.index.length;
    console.log(href);

    showMessage("Waiting for devices...")

    if(movieName.length>15){
        movieNameToShow = movieName.substring(0, 15)+"..."
    }else{
        movieNameToShow = movieName
    }
    if(movieHash.length>0 && isMac){
      secondaryMessage("<a class='cursored' onclick='openInFinder(\'"+engine.path+"\'); '>"+movieNameToShow+" ["+bytes(filelength)+"] </a>");
    }else{
      secondaryMessage(movieNameToShow+" ["+bytes(filelength)+"]");
    }
    console.log("("+bytes(filelength)+") "+filename.substring(0, 13)+"...");

    var updateStatus = function(){
      var unchoked = engine.swarm.wires.filter(active);
      statusMessage(unchoked, wires, swarm)
    }

    intervalArr.push(setInterval(updateStatus,250))

    var tryToPlay = function(){
      console.log('tryToPlay')
      if(self.devices){
        console.log(self.devices)
        playInDevices(href)
        /*
        self.devices.forEach(function(dev){
          if(dev.active){
            showMessage("Streaming")
            dev.play(href, 0, function() {
              console.log(">>> Playing in devices: "+href)
              showMessage("Streaming")
              if(dev.togglePlayIcon){
                console.log("Toggling play icon")
                dev.togglePlayIcon()
              }
            });
          }
        });
        */
      }
    };

    emitter.on('wantToPlay', tryToPlay);

    emitter.emit('wantToPlay');

  });
}
