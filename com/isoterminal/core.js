//ISOTerminal.prototype.exec(cmd_array,stdin){
//  // exec(['lua'] "print \"hello\") ---> cat /dev/browser/js/stdin | lua > /dev/browser/js/stdout
//}

ISOTerminal.prototype.send = function(ttyNr, str){
  this.toUint8Array( str ).map( (c) => this.emulator.bus.send(`serial${ttyNr}-input`, c ) )
}

ISOTerminal.prototype.toUint8Array = function(str) {
  str = String(str) || String("")
  // Create a new Uint8Array with the same length as the input string
  const uint8Array = new Uint8Array(str.length);
  
  // Iterate over the string and populate the Uint8Array
  for (let i = 0; i < str.length; i++) {
      uint8Array[i] = str.charCodeAt(i);
  }
  return uint8Array;
},

ISOTerminal.prototype.runISO = function(opts){
  this.opts = opts
  let image = {}
  if( opts.iso.match(/\.iso$/) ) image.cdrom   = { url: opts.iso }
  if( opts.iso.match(/\.bin$/) ) image.bzimage = { url: opts.iso }

  let emulator = this.emulator = new V86({ ...image,
    uart1:true, // /dev/ttyS1
    uart2:true, // /dev/ttyS2
    uart3:true, // /dev/ttyS3
    wasm_path:        "com/isoterminal/v86.wasm",
    memory_size:      32 * 1024 * 1024,
    vga_memory_size:  2 * 1024 * 1024,
    serial_container_xtermjs: opts.dom,
    //screen_container: dom, //this.canvas.parentElement,
    bios: {
      url: "com/isoterminal/bios/seabios.bin",
    },
    vga_bios: {
      url: "com/isoterminal/bios/vgabios.bin",
    },
    network_relay_url: "wss://relay.widgetry.org/",
    cmdline: "rw root=host9p rootfstype=9p rootflags=trans=virtio,cache=loose modules=virtio_pci tsc=reliable init_on_free=on",
    //bzimage_initrd_from_filesystem: true,
    //filesystem: {
    //          baseurl: "com/isoterminal/v86/images/alpine-rootfs-flat",
    //          basefs:  "com/isoterminal/v86/images/alpine-fs.json",
    //      },
    //screen_dummy: true,
    //disable_jit: false,
    filesystem: {},
    autostart: true,
  });


  const loading = [
    'loading quantum bits and bytes',
    'preparing quantum flux capacitors',
    'crunching peanuts and chakras',
    'preparing parallel universe',
    'loading quantum state fluctuations',
    'preparing godmode',
    'loading cat pawns and cuteness',
    'beaming up scotty',
    'still faster than Windows update',
    'loading a microlinux',
    'figuring out meaning of life',
    'Aligning your chakras now',
    'Breathing in good vibes',
    'Finding inner peace soon',
    'Centering your Zen energy',
    'Awakening third eye powers',
    'Tuning into the universe',
    'Balancing your cosmic karma',
    'Stretching time and space',
    'Recharging your soul battery',
    'Transcending earthly limits'
  ]

  let loadmsg = loading[ Math.floor(Math.random()*1000) % loading.length-1 ]
  this.emit('status',loadmsg)

  // replace welcome message https://github.com/copy/v86/blob/3c77b98bc4bc7a5d51a2056ea73d7666ca50fc9d/src/browser/serial.js#L231
  let welcome = "This is the serial console. Whatever you type or paste here will be sent to COM1"

  let motd = "\r[38;5;129m" 
  let msg  = `${loadmsg}, please wait..`
  while( msg.length < welcome.length ) msg += " "
  msg += "\n"
  motd += msg+"\033[0m" 

  const files = [
    "com/isoterminal/mnt/js",
    "com/isoterminal/mnt/jsh",
    "com/isoterminal/mnt/xrsh",
    "com/isoterminal/mnt/profile",
    "com/isoterminal/mnt/profile.sh",
    "com/isoterminal/mnt/profile.xrsh",
    "com/isoterminal/mnt/profile.js",
    "com/isoterminal/mnt/motd",
    "com/isoterminal/mnt/v86pipe"
  ]

  emulator.bus.register("emulator-started", async (e) => {
    this.emit('emulator-started',e)
    emulator.serial_adapter.term.clear()
    emulator.serial_adapter.term.write(motd)

    let p = files.map( (f) => fetch(f) )
    Promise.all(p)
    .then( (files) => {
      files.map( (f) => {
        f.arrayBuffer().then( (buf) => {
          emulator.create_file( f.url.replace(/.*mnt\//,''), new Uint8Array(buf) )
        })
      })
    })

    //emulator.serial0_send('chmod +x /mnt/js')
    //emulator.serial0_send()
    let line = ''
    let ready = false
    emulator.add_listener("serial0-output-byte", async (byte) => {
        this.emit('serial0-output-byte',byte)
        var chr = String.fromCharCode(byte);
        if(chr < " " && chr !== "\n" && chr !== "\t" || chr > "~")
        {
            return;
        }

        if(chr === "\n")
        {
            var new_line = line;
            line = "";
        }
        else if(chr >= " " && chr <= "~")
        {
            line += chr;
        }

        if( !ready && line.match(/^(\/ #|~%)/) ){
          this.emit('ready')
          ready = true
            //emulator.serial0_send("root\n")
            //emulator.serial0_send("mv /mnt/js . && chmod +x js\n")
        }
    });    
  });

}

ISOTerminal.prototype.readFromPipe = function(filename,cb){

  this.emulator.add_listener("9p-write-end", async (opts) => {
    const decoder = new TextDecoder('utf-8');
    if ( opts[0] == filename.replace(/.*\//,'') ){
      const buf = await this.emulator.read_file("console.tty")
      const val = decoder.decode(buf)
      cb(val)
    }
  })

}