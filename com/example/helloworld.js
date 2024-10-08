AFRAME.registerComponent('helloworld', {
  schema: { 
    wireframe: { type:"boolean", "default":false},
    text: {type:"string","default":"hello world"}
  },

  dependencies: ['data2event'],

  init: async function() {
    this.el.object3D.visible = false

    await AFRAME.utils.require(this.dependencies)
    this.el.setAttribute("data2event","")
    this.el.setAttribute("grabbable","")

    this.el.innerHTML = `
       <a-box position="-1 0.5 -3" rotation="0 45 0" color="#4CC3D9"></a-box>
       <a-sphere position="0 1.25 -5" radius="1.25" color="#EF2D5E"></a-sphere>
       <a-cylinder position="1 0.75 -3" radius="0.5" height="1.5" color="#FFC65D"></a-cylinder>
       <a-entity position="0 1.8 -3" scale="10 10 10" text="value: ${this.data.text}; align:center; color:#888"></a-entity>
    `
  },

  events:{

    launcher:      function(e){ 
      this.el.object3D.visible = !this.el.object3D.visible 
      clearInterval(this.interval)
      this.interval            = setInterval( () => {
        this.data.wireframe = !this.data.wireframe
      }, 500  )
    },

    // reactive this.data value demo 
    wireframe:function( ){ 
      this.el.object3D.traverse( (obj) => obj.material && (obj.material.wireframe = this.data.wireframe) )
    }

  },

  manifest: { // HTML5 manifest to identify app to xrsh
    "short_name": "Hello world",
    "name": "Hello world",
    "icons": [
      {
        "src": "https://css.gg/shape-hexagon.svg",
        "src": "data:image/svg+xml;base64,PHN2ZwogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIKPgogIDxwYXRoCiAgICBmaWxsLXJ1bGU9ImV2ZW5vZGQiCiAgICBjbGlwLXJ1bGU9ImV2ZW5vZGQiCiAgICBkPSJNNiAxNS4yMzQ4TDEyIDE4LjU2ODFMMTggMTUuMjM0OFY4Ljc2NTIxTDEyIDUuNDMxODhMNiA4Ljc2NTIxVjE1LjIzNDhaTTEyIDJMMyA3VjE3TDEyIDIyTDIxIDE3VjdMMTIgMloiCiAgICBmaWxsPSJjdXJyZW50Q29sb3IiCiAgLz4KPC9zdmc+",
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

