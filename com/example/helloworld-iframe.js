AFRAME.registerComponent('helloworld-iframe', {
  schema: { 
    url: { type:"string"}
  },

  init: function(){},

  requires:{
    html:        "https://unpkg.com/aframe-htmlmesh@2.1.0/build/aframe-html.js",  // html to AFRAME
    winboxjs:    "https://unpkg.com/winbox@0.2.82/dist/winbox.bundle.min.js",     // deadsimple windows: https://nextapps-de.github.io/winbox
    winboxcss:   "https://unpkg.com/winbox@0.2.82/dist/css/winbox.min.css",       // 
  },

  dom: {
    scale:   3,
    events:  ['click','keydown'],
    html:    (me) => `<div class="relative">
                        <span id="warning">
                          <b>Unfortunately,</b><br><br>
                          The browser does not allow IFRAME rendering<br>
                          in immersive mode (for security reasons).<br><br>
                        </span>  
                        <iframe src=""></iframe>
                      </div>`,

    css:     (me) => `
      .XR #overlay .winbox.iframe{ 
        visibility: visible; 
        position:relative;
      } /* don't hide in XR mode */
      .winbox.iframe > .wb-body  { background:#FFF !important; 
                                   overflow-y: hidden;
                                   overflow-x: hidden;
                                 }
      .winbox.iframe iframe      { z-index:10;    }
      .winbox.iframe #warning    { position:absolute; z-index:9; top:100px; left:20px; width:100%; height:50px; color:black; display:none; }
    `
  },

  events:{

    // combined AFRAME+DOM reactive events
    click:   function(e){ }, // 
    keydown: function(e){ }, // 

    // reactive updates (data2event.js)
    url: function(e){ 
      this.el.dom.querySelector('iframe').src = this.data.url
      console.dir(this.el.dom.querySelector('iframe'))
    },

    launcher: async function(){
      let URL = this.data.url || prompt('enter URL to display','https://fabien.benetou.fr/Wiki/Wiki')
      if( !URL ) return

      this.createWindow()
    },

    createWindow: function(){
      let s = await AFRAME.utils.require(this.requires)

      // instance this component
      const instance = this.el.cloneNode(false)
      this.el.sceneEl.appendChild( instance )
      instance.setAttribute("dom",       "")
      instance.setAttribute("data2event","")
      instance.setAttribute("visible",  AFRAME.utils.XD() == '3D' ? 'true' : 'false' )
      instance.setAttribute("position", AFRAME.utils.XD.getPositionInFrontOfCamera(1.39) )
      instance.object3D.quaternion.copy( AFRAME.scenes[0].camera.quaternion ) // face towards camera

      this.el.sceneEl.addEventListener('3D', () => {
        instance.dom.querySelector('#warning').style.display = 'block' // show warning
      })

      const setupWindow = () => {
        const com = instance.components['helloworld-iframe']
        instance.dom.style.display = 'none'
        new WinBox( this.manifest.short_name+" "+URL,{ 
          width: Math.round(window.innerWidth*0.6),
          height: Math.round(window.innerHeight*0.6),
          class:["iframe"],
          x:"center",
          y:"center",
          id:  instance.uid, // important hint for html-mesh  
          root: document.querySelector("#overlay"),
          mount: instance.dom,
          onclose: () => { instance.dom.style.display = 'none'; return false; },
          oncreate: () => {
            com.data.url = URL
            instance.setAttribute("position", AFRAME.utils.XD.getPositionInFrontOfCamera(0.5) )
            instance.setAttribute("html",`html:#${instance.uid}; cursor:#cursor`)
            instance.setAttribute("show-texture-in-xr","") // only show aframe-html texture in xr mode
          }
        });
        instance.dom.style.display = ''
      }

      setTimeout( () => setupWindow(), 10 ) // give new components time to init
    },

  },

  manifest: { // HTML5 manifest to identify app to xrsh
    "short_name": "Iframe",
    "name": "Hello world IFRAME window",
    "icons": [
      {
        "src": "https://css.gg/browse.svg",
        "src": "data:image/svg+xml;base64,PHN2ZwogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKPgogIDxwYXRoCiAgICBkPSJNNCA4QzQuNTUyMjggOCA1IDcuNTUyMjggNSA3QzUgNi40NDc3MiA0LjU1MjI4IDYgNCA2QzMuNDQ3NzIgNiAzIDYuNDQ3NzIgMyA3QzMgNy41NTIyOCAzLjQ0NzcyIDggNCA4WiIKICAgIGZpbGw9ImN1cnJlbnRDb2xvciIKICAvPgogIDxwYXRoCiAgICBkPSJNOCA3QzggNy41NTIyOCA3LjU1MjI4IDggNyA4QzYuNDQ3NzIgOCA2IDcuNTUyMjggNiA3QzYgNi40NDc3MiA2LjQ0NzcyIDYgNyA2QzcuNTUyMjggNiA4IDYuNDQ3NzIgOCA3WiIKICAgIGZpbGw9ImN1cnJlbnRDb2xvciIKICAvPgogIDxwYXRoCiAgICBkPSJNMTAgOEMxMC41NTIzIDggMTEgNy41NTIyOCAxMSA3QzExIDYuNDQ3NzIgMTAuNTUyMyA2IDEwIDZDOS40NDc3MSA2IDkgNi40NDc3MiA5IDdDOSA3LjU1MjI4IDkuNDQ3NzEgOCAxMCA4WiIKICAgIGZpbGw9ImN1cnJlbnRDb2xvciIKICAvPgogIDxwYXRoCiAgICBmaWxsLXJ1bGU9ImV2ZW5vZGQiCiAgICBjbGlwLXJ1bGU9ImV2ZW5vZGQiCiAgICBkPSJNMyAzQzEuMzQzMTUgMyAwIDQuMzQzMTUgMCA2VjE4QzAgMTkuNjU2OSAxLjM0MzE1IDIxIDMgMjFIMjFDMjIuNjU2OSAyMSAyNCAxOS42NTY5IDI0IDE4VjZDMjQgNC4zNDMxNSAyMi42NTY5IDMgMjEgM0gzWk0yMSA1SDNDMi40NDc3MiA1IDIgNS40NDc3MiAyIDZWOUgyMlY2QzIyIDUuNDQ3NzIgMjEuNTUyMyA1IDIxIDVaTTIgMThWMTFIMjJWMThDMjIgMTguNTUyMyAyMS41NTIzIDE5IDIxIDE5SDNDMi40NDc3MiAxOSAyIDE4LjU1MjMgMiAxOFoiCiAgICBmaWxsPSJjdXJyZW50Q29sb3IiCiAgLz4KPC9zdmc+",
        "type": "image/svg+xml",
        "sizes": "512x512"
      }
    ],
    "id": "/?source=pwa",
    "start_url": "/?source=pwa",
    "background_color": "#3367D6",
    "display": "standalone",
    "scope": "/",
    "theme_color": "#3367D6",
    "shortcuts": [
      {
        "name": "What is the latest news?",
        "cli":{
          "usage":  "helloworld <type> [options]",
          "example": "helloworld news",
          "args":{
            "--latest": {type:"string"}
          }
        },
        "short_name": "Today",
        "description": "View weather information for today",
        "url": "/today?source=pwa",
        "icons": [{ "src": "/images/today.png", "sizes": "192x192" }]
      }
    ],
    "description": "Hello world information",
    "screenshots": [
      {
        "src": "/images/screenshot1.png",
        "type": "image/png",
        "sizes": "540x720",
        "form_factor": "narrow"
      }
    ],
    "help":`
Helloworld application 

This is a help file which describes the application.
It will be rendered thru troika text, and will contain
headers based on non-punctualized lines separated by linebreaks,
in above's case "\nHelloworld application\n" will qualify as header.
    `
  }

});

