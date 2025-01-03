// https://raw.githubusercontent.com/vetupinitsyn/vt100/refs/heads/coffeescript/public/javascripts/VT100.js
// 
// VT100.js -- a text terminal emulator in JavaScript with a ncurses-like
// interface and a POSIX-like interface. (The POSIX-like calls are
// implemented on top of the ncurses-like calls, not the other way round.)
// 
// required markup:
//
//   <div id="term" tabindex="0">
//      <pre></pre>
//   </div>

//
// Released under the GNU LGPL v2.1, by Frank Bi <bi@zompower.tk>
//
//
// 2024-08-xx upgraded things to work in WebXR (xterm.js too heavy)
// 2007-08-12	- refresh():
//		  - factor out colour code to html_colours_()
//		  - fix handling of A_REVERSE | A_DIM
//		  - simplify initial <br /> output code
//		  - fix underlining colour
//		- fix attron() not to turn off attributes
//		- decouple A_STANDOUT and A_BOLD
// 2007-08-11	- getch() now calls refresh()
// 2007-08-06	- Safari compat fix -- turn '\r' into '\n' for onkeypress
// 2007-08-05	- Opera compat fixes for onkeypress
// 2007-07-30	- IE compat fixes:
//		  - change key handling code
//		  - add <br />...<br />&nbsp; so that 1st and last lines align
// 2007-07-28	- change wrapping behaviour -- writing at the right edge no
//		  longer causes the cursor to immediately wrap around
//		- add <b>...</b> to output to make A_STANDOUT stand out more
//		- add handling of backspace, tab, return keys
//		- fix doc. of VT100() constructor
//		- change from GPL to LGPL
// 2007-07-09	- initial release
//
// class VT100
//	A_NORMAL, A_UNDERLINE, A_REVERSE, A_BLINK, A_DIM, A_BOLD, A_STANDOUT
//	=class constants=
//			Attribute constants.
//	VT100(wd, ht, scr_id) =constructor=
//			Creates a virtual terminal with width `wd', and
//			height `ht'. The terminal will be displayed between
//			<pre>...</pre> tags which have element ID `scr_id'.
//	addch(ch [, attr])
//			Writes out the character `ch'. If `attr' is given,
//			it specifies the attributes for the character,
//			otherwise the current attributes are used.
//	addstr(stuff)	Writes out the string `stuff' using the current
//			attributes.
//	attroff(mode)	Turns off any current options given in mode.
//	attron(mode)	Turns on any options given in mode.
//	attrset(mode)	Sets the current options to mode.
//	bkgdset(attr)	Sets the background attributes to attr.
//	clear()		Clears the terminal using the background attributes,
//			and homes the cursor.
//	clrtobol()	Clears the portion of the terminal from the cursor
//			to the bottom.
//	clrtoeol()	Clears the portion of the current line after the
//			cursor.
//	curs_set(vis [, grab])
//			If `vis' is 0, makes the cursor invisible; otherwise
//			make it visible. If `grab' is given and true, starts
//			capturing keyboard events (for `getch()'); if given
//			and false, stops capturing events.
//	echo()		Causes key strokes to be automatically echoed on the
//			terminal.
//	erase()		Same as `clear()'.
//	getch(isr)	Arranges to call `isr' when a key stroke is
//			received. The received character and the terminal
//			object are passed as arguments to `isr'.
//	getmaxyx()	Returns an associative array with the maximum row
//			(`y') and column (`x') numbers for the terminal.
//	getyx()		Returns an associative array with the current row
//			(`y') and column (`x') of the cursor.
//	move(r, c)	Moves the cursor to row `r', column `c'.
//	noecho()	Stops automatically echoing key strokes.
//	refresh()	Updates the display.
//	scroll()	Scrolls the terminal up one line.
//	standend()	Same as `attrset(VT100.A_NORMAL)'.
//	standout()	Same as `attron(VT100.A_STANDOUT)'.
//	write(stuff)	Writes `stuff' to the terminal and immediately
//			updates the display; (some) escape sequences are
//			interpreted and acted on.

// constructor
function VT100(opts)
{
  this.opts = opts
  let {cols, rows, el_or_id, max_scroll_lines, fg, bg, nodim} = opts
	if (!max_scroll_lines) {
		max_scroll_lines = 1000;
	}
	if (typeof(fg) == 'undefined') {
		fg = VT100.COLOR_WHITE;
	}
	if (typeof(bg) == 'undefined') {
		bg = VT100.COLOR_TRANSPARENT //COLOR_BLACK;
	}

  console.dir(opts)

	var r;
	var c;
	var scr = typeof el_or_id == 'string' ? document.getElementById(el_or_id) : el_or_id
	this.wd_ = cols;
	this.ht_ = rows;
	// Keep up to max_scroll_lines of scrollback history.
	this.max_ht_ = max_scroll_lines;
	this._set_colors(fg, bg);
	this.text_ = new Array(rows);
	this.attr_ = new Array(rows);
	this.redraw_ = new Array(rows);
	this.scroll_region_ = [0, rows-1];
	this.start_row_id = 0;
	this.num_rows_ = rows;
	for (r = 0; r < rows; ++r) {
		this.text_[r] = new Array(cols);
		this.attr_[r] = new Array(cols);
		this.redraw_[r] = 1;
	}
	this.scr_ = scr;
  this.scr_.style.display = 'block'
  this.scr_.style.overflowY = 'scroll'
  this.scr_.style.height = '100%'
  this.setupTouchInputFallback() // smartphone/android 
	this.cursor_vis_ = true;
	this.cursor_key_mode_ = VT100.CK_CURSOR;
	this.grab_events_ = false;
	this.getch_isr_ = undefined;
	this.key_buf_ = [];
	this.echo_ = false;
	this.esc_state_ = 0;
	this.log_level_ = VT100.WARN //VT100.DEBUG 

	this.clear_all();

  // rate limit this.refresh
  this.refresh = this.throttleSmart( VT100.prototype.refresh.bind(this), 100)
}

// public constants -- colours and colour pairs
VT100.COLOR_TRANSPARENT = -1;
VT100.COLOR_BLACK = 0;
VT100.COLOR_BLUE = 1;
VT100.COLOR_GREEN = 2;
VT100.COLOR_CYAN = 3;
VT100.COLOR_RED = 4;
VT100.COLOR_MAGENTA = 5;
VT100.COLOR_YELLOW = 6;
VT100.COLOR_WHITE = 7;
VT100.COLOR_PAIRS = 256;
VT100.COLORS = 8;
// Cursor key modes.
VT100.CK_CURSOR = 0;
VT100.CK_APPLICATION = 1;
// public constants -- attributes
VT100.A_NORMAL = 0;
VT100.A_UNDERLINE = 1;
VT100.A_REVERSE = 2;
VT100.A_BLINK = 4;
VT100.A_DIM = 8;
VT100.A_BOLD = 16;
VT100.A_STANDOUT = 32;
VT100.A_PROTECT = VT100.A_INVIS = 0; // ?
// other public constants
VT100.TABSIZE = 8;
// private constants
VT100.ATTR_FLAGS_ = VT100.A_UNDERLINE | VT100.A_REVERSE | VT100.A_BLINK |
		    VT100.A_DIM | VT100.A_BOLD | VT100.A_STANDOUT |
		    VT100.A_PROTECT | VT100.A_INVIS;
VT100.COLOR_SHIFT_ = 6;
VT100.browser_ie_ = (navigator.appName.indexOf("Microsoft") != -1);
VT100.browser_opera_ = (navigator.appName.indexOf("Opera") != -1);
// logging levels
VT100.WARN = 1;
VT100.INFO = 2;
VT100.DEBUG = 3;
// class variables
VT100.the_vt_ = undefined;

// class methods

// this is actually an event handler
VT100.handle_onkeypress_ = function VT100_handle_onkeypress(event,cb)
{
	//dump("event target: " + event.target.id + "\n");
	//dump("event originalTarget: " + event.originalTarget.id + "\n");
	var vt = VT100.the_vt_, ch;
	if (vt === undefined)
		return true;

	//if ( event.keyCode != undefined || !event.charCode){
	//	ch = event.keyCode;
	//	if (ch == 13)
	//		ch = 10;
	//	else if (ch > 255 || (ch < 32 && ch != 8))
	//		return true;
	//	ch = String.fromCharCode(ch);
	//} else {
  //dump("ch: " + ch + "\n");
  //dump("ctrl?: " + event.ctrlKey + "\n");
  vt.debug("onkeypress:: ch: " + event.code + " ,key: "+event.key);
  if (event.key.length == 1) {
    ch = event.key.charCodeAt(0)
    if (ch > 255)
      return true;
    if (event.ctrlKey && event.shiftKey) {
      // Don't send the copy/paste commands.
      var charStr = String.fromCharCode(ch);
      if (charStr == 'C' || charStr == 'V') {
        return false;
      }
    }
    if (event.ctrlKey) {
      ch = String.fromCharCode(ch - 96);
    } else {
      ch = String.fromCharCode(ch);
      if (ch == '\r')
        ch = '\n';
    }
  } else {
    switch (event.code) {
      case "Backspace":
        ch = '\b';
        break;
      case "Tab":
        ch = '\t';
        break;
      case "Enter":
        ch = '\n';
        break;
      case "ArrowUp":
        if (this.cursor_key_mode_ == VT100.CK_CURSOR)
        ch = '\x1b[A';
        else
        ch = '\x1bOA';
        break;
      case "ArrowDown":
        if (this.cursor_key_mode_ == VT100.CK_CURSOR)
        ch = '\x1b[B';
        else
        ch = '\x1bOB';
        break;
      case "ArrowRight":
        if (this.cursor_key_mode_ == VT100.CK_CURSOR)
        ch = '\x1b[C';
        else
        ch = '\x1bOC';
        break;
      case "ArrowLeft":
        if (this.cursor_key_mode_ == VT100.CK_CURSOR)
        ch = '\x1b[D';
        else
        ch = '\x1bOD';
        break;
      case "Delete":
        ch = '\x1b[3~';
        break;
      case "Home":
        ch = '\x1b[H';
        break;
      case "Escape":
        ch = '\x1b';
      case "Control":
        break;
      case "PageDown":
        ch = '\x1b[6~';
        break;
      case "PageUp":
        ch = '\x1b[5~';
        break;
      default:
        return true
        break;
    }
  }
  // custom map override
  if( vt.opts.map[ event.code ]?.ch                    ) ch = vt.opts.map[ event.code ].ch
  if( vt.opts.map[ event.code ]?.ctrl && event.ctrlKey ) ch = vt.opts.map[ event.code ].ctrl 

  // Workaround: top the event from doing anything else.
  // (prevent input from adding characters instead of via VM)
  event.preventDefault()
  vt.key_buf_.push(ch);

  if( cb ){
    cb(vt.key_buf_)
    vt.key_buf_ = []
  }else setTimeout(VT100.go_getch_, 0);

	return false;
}

// this is actually an event handler
VT100.handle_onkeydown_ = function VT100_handle_onkeydown()
{
	var vt = VT100.the_vt_, ch;
	switch (event.keyCode) {
	    case 8:
		ch = '\b';	break;
	    default:
		return true;
	}
  event.preventDefault()
	vt.key_buf_.push(ch);
	setTimeout(VT100.go_getch_, 0);
	return false;
}

VT100.go_getch_ = function VT100_go_getch()
{
	var vt = VT100.the_vt_;
	if (vt === undefined)
		return;
	var isr = vt.getch_isr_;
	//vt.getch_isr_ = undefined;
	if (isr === undefined)
		return;
	var ch = vt.key_buf_.shift();
	if (ch === undefined) {
		vt.getch_isr_ = isr;
		return;
	}
	if (vt.echo_)
		vt.addch(ch);
	isr(ch, vt);
}

// object methods

VT100.prototype.may_scroll_ = function VT100_may_scroll_()
{
	var ht = this.ht_, cr = this.row_;
	while (cr >= ht) {
		this.scroll();
		--cr;
	}
	this.row_ = cr;
}

VT100.prototype.html_colours_ = function VT100_html_colours_(attr)
{
	var fg, bg, co0, co1;
	fg = attr.fg;
	bg = attr.bg;
  switch (attr.mode & (VT100.A_REVERSE | VT100.A_DIM | VT100.A_BOLD)) {
    case 0:
    case VT100.A_DIM | VT100.A_BOLD:
      co0 = '00';
      if (bg == VT100.COLOR_WHITE)
      co1 = 'ff';
      else
      co1 = 'c0';
      break;
    case VT100.A_BOLD:
      co0 = '00';  co1 = 'ff';
      break;
    case VT100.A_DIM:
      if (fg == VT100.COLOR_BLACK)
        co0 = '40';
      else
        co0 = '00';
        co1 = '40';
      break;
    case VT100.A_REVERSE:
    case VT100.A_REVERSE | VT100.A_DIM | VT100.A_BOLD:
      co0 = 'c0';  co1 = 'ff';
      break;
    case VT100.A_REVERSE | VT100.A_BOLD:
      co0 = 'c0';  co1 = '00';
      break;
    default:
      if (fg == VT100.COLOR_BLACK)
      co0 = '80';
      else
      co0 = 'c0';
      co1 = 'c0';
  }
	return {
		f: '#' + (fg & 4 ? co1 : co0) +
			 (fg & 2 ? co1 : co0) +
			 (fg & 1 ? co1 : co0),
		b: attr.bg == VT100.COLOR_TRANSPARENT ? 'transparent' : '#' + (bg & 4 ? co1 : co0) +
			 (bg & 2 ? co1 : co0) +
			 (bg & 1 ? co1 : co0)
	    };
}

VT100.prototype.addch = function VT100_addch(ch, attr)
{
	var cc = this.col_;
	this.debug("addch:: ch: " + ch + ", attr: " + attr);
	this.redraw_[this.row_] = 1;

	switch (ch) {
	    case '\b':
		if (cc != 0)
			--cc;
		break;
	    case '\n':
		++this.row_;
		cc = 0;
		this.clrtoeol();
		this.may_scroll_();
		break;
	    case '\r':
		this.may_scroll_();
		cc = 0;
		break;
	    case '\t':
		this.may_scroll_();
		cc += VT100.TABSIZE - cc % VT100.TABSIZE;
		if (cc >= this.wd_) {
			++this.row_;
			cc -= this.wd_;
		}
		break;
	    default:
		if (attr === undefined) {
			attr = this.c_attr_;
		}
		if (cc >= this.wd_) {
			++this.row_;
			cc = 0;
			this.may_scroll_();
		}
		this.text_[this.row_][cc] = ch;
		this.attr_[this.row_][cc] = attr;
		++cc;
	}
	this.col_ = cc;
}

VT100.prototype.addstr = function VT100_addstr(stuff)
{
	for (var i = 0; i < stuff.length; ++i)
		this.addch(stuff.charAt(i));
}

VT100.prototype._cloneAttr = function VT100_cloneAttr(a)
{
	return {
		mode: a.mode,
		fg: a.fg,
		bg: a.bg
	};
}

VT100.prototype.attroff = function(a)
{
	//dump("attroff: " + a + "\n");
	a &= VT100.ATTR_FLAGS_;
	this.c_attr_ = this._cloneAttr(this.c_attr_);
	this.c_attr_.mode &= ~a;
}

VT100.prototype.attron = function(a)
{
	//dump("attron: " + a + "\n");
	a &= VT100.ATTR_FLAGS_;
	this.c_attr_ = this._cloneAttr(this.c_attr_);
	this.c_attr_.mode |= a;
}

VT100.prototype.attrset = function(a)
{
	//dump("attrset: " + a + "\n");
	this.c_attr_ = this._cloneAttr(this.c_attr_);
	this.c_attr_.mode = a;
}

VT100.prototype.fgset = function(fg)
{
	//dump("fgset: " + fg + "\n");
	this.c_attr_ = this._cloneAttr(this.c_attr_);
	this.c_attr_.fg = fg;
}

VT100.prototype.bgset = function(bg)
{
	//dump("bgset: " + bg + "\n");
	this.c_attr_ = this._cloneAttr(this.c_attr_);
	this.c_attr_.bg = bg;
}

VT100.prototype.bkgdset = function(a)
{
	this.bkgd_ = a;
}

VT100.prototype.clear_all = function VT100_clear_all()
{
	this.info("clear_all");
	this.clear();

	var elem = this.scr_;
	var firstChild = elem.firstChild;
	while (firstChild) {
		elem.removeChild(firstChild);
		firstChild = elem.firstChild;
	}
	this.num_rows_ = this.ht_;
	this.start_row_id = 0;

	// Create the content element which will contain the terminal output.
	// The html rows are added as a group of rows, making it easy to later
	// delete a bunch of rows in one go when they have scrolled off the end.
	var group_element = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
	elem.appendChild(group_element);
	this.group_element_ = group_element;
}

VT100.prototype.clear = function VT100_clear()
{
	this.info("clear");
	this.row_ = this.col_ = 0;
	var r, c;
	for (r = 0; r < this.ht_; ++r) {
		for (c = 0; c < this.wd_; ++c) {
			this.text_[r][c] = ' ';
			this.attr_[r][c] = this.bkgd_;
		}
		this.redraw_[r] = 1;
	}
}

VT100.prototype.clrtobot = function VT100_clrtobot()
{
	this.info("clrtobot, row: " + this.row_);
	var ht = this.ht_;
	var wd = this.wd_;
	this.clrtoeol();
	var attr = this.c_attr_ ? this.c_attr_ : this.bkgd_;
	for (var r = this.row_ + 1; r < ht; ++r) {
		for (var c = 0; c < wd; ++c) {
			this.text_[r][c] = ' ';
			this.attr_[r][c] = attr;
		}
		this.redraw_[r] = 1;
	}
}

VT100.prototype.clrtoeol = function VT100_clrtoeol()
{
	this.info("clrtoeol, col: " + this.col_);
	var r = this.row_;
	if (r >= this.ht_)
		return;
	var attr = this.c_attr_ ? this.c_attr_ : this.bkgd_;
	for (var c = this.col_; c < this.wd_; ++c) {
		this.text_[r][c] = ' ';
		this.attr_[r][c] = attr;
	}
	this.redraw_[r] = 1;
}

VT100.prototype.clearpos = function VT100_clearpos(row, col)
{
	this.info("clearpos (" + row + ", " + col + ")");
	if (row < 0 || row >= this.ht_)
		return;
	if (col < 0 || col >= this.wd_)
		return;
	this.text_[row][col] = ' ';
	this.attr_[row][col] = this.bkgd_;
	this.redraw_[row] = 1;
}

VT100.prototype.curs_set = function(vis, grab, offscreenKB)
{
  // offscreenKB is a div which receives keys from physical kb's 
  // but not from touch keyboards (they require an input-field)
  // hence setupTouchInputFallback()..this is how we seperate the two
	this.info("curs_set:: vis: " + vis + ", grab: " + grab);
	if (vis !== undefined){
		this.cursor_vis_ = (vis > 0);
  }
	if (offscreenKB === undefined)
		offscreenKB = this.scr_;
	if (grab === true || grab === false) {
		if (grab === this.grab_events_)
			return;
		if (grab) {
			this.grab_events_ = true;
			VT100.the_vt_ = this;
			offscreenKB.addEventListener("keypress", VT100.handle_onkeypress_, false);
			offscreenKB.addEventListener("keydown", VT100.handle_onkeypress_, false);
		} else {
			offscreenKB.removeEventListener("keypress", VT100.handle_onkeypress_, false);
			offscreenKB.removeEventListener("keydown", VT100.handle_onkeypress_, false);
			this.grab_events_ = false;
			VT100.the_vt_ = undefined;
		}
	}
}

VT100.prototype.echo = function()
{
	this.info("echo on");
	this.echo_ = true;
}

VT100.prototype.erase = VT100.prototype.clear;

VT100.prototype.getch = function(isr)
{
	this.info("getch");
	this.refresh();
	this.getch_isr_ = isr;
	setTimeout(VT100.go_getch_, 0);
}

VT100.prototype.getmaxyx = function()
{
	return { y: this.ht_ - 1, x: this.wd_ - 1 };
}

VT100.prototype.getyx = function()
{
	return { y: this.row_, x: this.col_ };
}

VT100.prototype.move = function(r, c)
{
	this.info("move: (" + r + ", " + c + ")");
	this.redraw_[this.row_] = 1;
	if (r < 0)
		r = 0;
	else if (r >= this.ht_)
		r = this.ht_ - 1;
	if (c < 0)
		c = 0;
	else if (c >= this.wd_)
		c = this.wd_ - 1;
	this.row_ = r;
	this.col_ = c;
	this.redraw_[this.row_] = 1;
}

VT100.prototype.noecho = function()
{
	this.info("echo off");
	this.echo_ = false;
}

VT100.prototype.refresh = function VT100_refresh()
{
	//this.info("refresh");
	var r, c, html = "", row_html, start_tag = "", end_tag = "",
	    at = -1, n_at, ch, pair, added_end_tag;
	var ht = this.ht_;
	var wd = this.wd_;
	var cr = this.row_;
	var cc = this.col_;
	var cv = this.cursor_vis_;
	if (cc >= wd)
		cc = wd - 1;
	var base_row_id = this.num_rows_ - ht;
	var id;

	// XXX: Remove older rows if past max_ht_ rows.
	var num_rows = this.num_rows_ - this.start_row_id;
	if ( this.scr_.firstChild && num_rows >= (this.max_ht_ + 100)) {
    // Remove one group of rows (i.e. a 100 rows).
    this.scr_.removeChild(this.scr_.firstChild);
    this.start_row_id += 100;
	}

	for (r = 0; r < ht; ++r) {
		if (!this.redraw_[r]) {
			continue;
		}
		//dump("Redrawing row: " + r + "\n");
		this.redraw_[r] = 0;
		id = base_row_id + r;
		row_html = "";
		for (c = 0; c < wd; ++c) {
			added_end_tag = false;
			n_at = this.attr_[r][c];
      const drawCursor = cv && r == cr && c == cc
			if (drawCursor){
				// Draw the cursor here.
				n_at = this._cloneAttr(n_at);
				n_at.mode ^= VT100.A_REVERSE;
			}
			// If the attributes changed, make a new span.
			if (n_at.mode != at.mode || n_at.fg != at.fg || n_at.bg != at.bg) {
				if (c > 0) {
					row_html += end_tag;
				}
				start_tag = "";
				end_tag = "";
				if (n_at.mode & VT100.A_BLINK) {
					start_tag = "<blink>";
					end_tag = "</blink>" + end_tag;
				}
				//if (n_at.mode & VT100.A_STANDOUT)
				//	n_at.mode |= VT100.A_BOLD;
				pair = this.html_colours_(n_at);
				start_tag += '<span style="color:' + pair.f +
				             ';background-color:' + pair.b;
				if (n_at.mode & VT100.A_BOLD)
					start_tag += ';font-weight: bolder';
				if (n_at.mode & VT100.A_UNDERLINE)
					start_tag += ';text-decoration:underline';
        if ( drawCursor )
          start_tag += '" class="cursor'
				start_tag += '">';
				row_html += start_tag;
				end_tag = "</span>" + end_tag;
				at = n_at;
				added_end_tag = true;
			} else if (c == 0) {
				row_html += start_tag;
			}
			ch = this.text_[r][c];
			switch (ch) {
			    case '&':
				row_html += '&amp;';	break;
			    case '<':
				row_html += '&lt;';	break;
			    case '>':
				row_html += '&gt;';	break;
			    case ' ':
				row_html += '&nbsp;';	break;
				//row_html += ' ';	break;
			    default:
				row_html += ch;
			}
		}
		if (!added_end_tag)
			row_html += end_tag;
		var div_element = document.getElementById(id);
		if (!div_element) {
			// Create a new div to append to.
			div_element = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
			div_element.setAttribute("id", id);
			if ((id % 100) == 99) {
				// Create a new group of rows.
				this.group_element_ = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
				this.scr_.appendChild(this.group_element_);
			}
			this.group_element_.appendChild(div_element);
		}
		div_element.innerHTML = row_html;
		//dump("adding row html: " + row_html + "\n");
	}
  this.scr_.scrollTop = this.scr_.scrollHeight
  this.curs_set(1)
}

VT100.prototype.set_max_scroll_lines = function(max_lines)
{
	this.max_ht_ = max_lines;
}

VT100.prototype._set_colors = function(fg_color, bg_color)
{
	this.bkgd_ = {
			mode: VT100.A_NORMAL,
			fg: fg_color,
			bg: bg_color
		     };
	this.c_attr_ = {
			mode: VT100.A_NORMAL,
			fg: fg_color,
			bg: bg_color
		     };
}

VT100.prototype.set_fg_color = function(fg_color)
{
	this._set_colors(fg_color, this.bkgd_.bg);
}

VT100.prototype.set_bg_color = function(bg_color)
{
	this._set_colors(this.bkgd_.fg, bg_color);
}

VT100.prototype.set_scrolling_region = function(start, end)
{
	start = Math.max(0, Math.min(start, this.ht_ - 1));
	end   = Math.max(0, Math.min(end,   this.ht_ - 1));
	this.scroll_region_ = [start, end];
}

VT100.prototype.scroll = function()
{
	var bottom = this.scroll_region_[0];
	var top = this.scroll_region_[1];
	var roll_rows = (this.row_ == (this.ht_ - 1));
	var n_text = this.text_[bottom], n_attr = this.attr_[bottom],
	    wd = this.wd_;
	for (var r = bottom+1; r <= top; ++r) {
		this.text_[r - 1] = this.text_[r];
		this.attr_[r - 1] = this.attr_[r];
		this.redraw_[r - 1] = !roll_rows || this.redraw_[r];
	}
	this.text_[top] = n_text;
	this.attr_[top] = n_attr;
	this.redraw_[top] = 1;
	for (var c = 0; c < wd; ++c) {
		n_text[c] = ' ';
		n_attr[c] = this.bkgd_;
	}
	if (roll_rows)
		this.num_rows_ += 1;
}

VT100.prototype.scrollup = function()
{
	var bottom = this.scroll_region_[0];
	var top = this.scroll_region_[1];
	var wd = this.wd_;
	var n_text = this.text_[top], n_attr = this.attr_[top];
	for (var r = top; r > bottom; r--) {
		this.text_[r] = this.text_[r - 1];
		this.attr_[r] = this.attr_[r - 1];
		this.redraw_[r] = 1;
	}
	this.text_[bottom] = n_text;
	this.attr_[bottom] = n_attr;
	for (var c = 0; c < wd; ++c) {
		n_text[c] = ' ';
		n_attr[c] = this.bkgd_;
	}
	this.redraw_[bottom] = 1;
}

VT100.prototype.standend = function()
{
	//this.info("standend");
	this.attrset(0);
}

VT100.prototype.standout = function()
{
	//this.info("standout");
	this.attron(VT100.A_STANDOUT);
}

VT100.prototype.write = function VT100_write(stuff)
{
  var ch, x, r, c, i, j, cv;
  var ht = this.ht_;
  var codes = "";
  var prev_esc_state_ = 0;
  var undrawn_rows;
  var ht_minus1 = ht - 1;
  var start_row_offset = ht - this.row_;
  var start_num_rows = this.num_rows_;
  for (i = 0; i < stuff.length; ++i) {
    // Refresh when there are undrawn rows that are about to be
    // scrolled off the screen, need to draw these rows before
    // the scrolling occurs, otherwise they will never be visible.
    undrawn_rows = (this.num_rows_ - start_num_rows) + start_row_offset;
    if (undrawn_rows >= ht) {
      cv = this.cursor_vis_;
      this.cursor_vis_ = false;
      this.refresh();
      this.cursor_vis_ = cv;
      start_row_offset = ht - this.row_;
      start_num_rows = this.num_rows_;
      //dump("refreshed\n");
    }
    ch = stuff.charAt(i);
    //alert(this.esc_state_);

    if (this.log_level_ >= VT100.INFO) {
      if (ch == '\x1b') {
        code = "ESC";
      } else {
        code = this.escape(ch);
      }
      this.debug("  write:: ch: " + ch.charCodeAt(0) + ", '" + code + "'");
      codes += code;
    }

    switch (ch) {
      case '\x00':
      case '\x7f':
        continue;
      case '\x07':  /* bell, ignore it (UNLESS waiting for OSC terminator, see below */
        if (this.esc_state_ != 8) {
          this.debug("          ignoring bell character: " + ch);
          continue;
        }
        break;
      // This is NOT an Escape sequence
      //case '\a':
      case '\b':
      case '\t':
      case '\r':
        this.addch(ch);
        continue;
      case '\n':
      case '\v':
      case '\f': // what a mess
        r = this.row_;
        if (r >= this.scroll_region_[1]) {
          this.scroll();
          this.move(this.scroll_region_[1], 0);
        } else {
          this.move(r + 1, 0);
        }
        continue;
      case '\x18':
      case '\x1a':
        this.esc_state_ = 0;
        this.debug("          set escape state: 0");
        continue;
      case '\x1b':
        this.esc_state_ = 1;
        this.debug("          set escape state: 1");
        continue;
      case '\x9b':
        this.esc_state_ = 2;
        this.debug("          set escape state: 2");
        continue;
      case '\x9d':
        this.osc_Ps = this.osc_Pt = "";
        this.esc_state_ = 7;
        this.debug("          set escape state: 7");
        continue;
    }
    prev_esc_state_ = this.esc_state_;
    // not a recognized control character
    switch (this.esc_state_) {
      case 0: // not in escape sequence
        this.addch(ch);
        break;
      case 1: // just saw ESC
        switch (ch) {
          case '[':
            this.esc_state_ = 2;
            this.debug("          set escape state: 2");
            break;
          case ']':
            this.osc_Ps = this.osc_Pt = "";
            this.esc_state_ = 7;
            this.debug("          set escape state: 7");
            break;
          case '(':
          case ')':
            this.esc_state_ = 10;
            this.debug("          set escape state: 10");
            break;
          case '=':
            /* Set keypade mode (ignored) */
            this.info("          set keypade mode: ignored");
            this.esc_state_ = 0;
            break;
          case '>':
            /* Reset keypade mode (ignored) */
            this.info("          reset keypade mode: ignored");
            this.esc_state_ = 0;
            break;
          case 'H':
            /* Set tab at cursor column (ignored) */
            this.info("          set tab cursor column: ignored");
            this.esc_state_ = 0;
            break;
          case 'D':
            /* Scroll display down one line */
            this.scroll();
            this.esc_state_ = 0;
            break;
          case 'D':
            /* Scroll display down one line */
            this.scroll();
            this.esc_state_ = 0;
          case 'M':
            /* Scroll display up one line */
            this.scrollup();
            this.esc_state_ = 0;
            break;
        }
        break;
      case 2: // just saw CSI
        switch (ch) {
          case 'K':
            /* Erase in Line */
            this.esc_state_ = 0;
            this.clrtoeol();
            continue;
          case 'H':
            /* Move to (0,0). */
            this.esc_state_ = 0;
            this.move(0, 0);
            continue;
          case 'J':
            /* Clear to the bottom. */
            this.esc_state_ = 0;
            this.clrtobot();
            continue;
          case 'r':
            /* Reset scrolling region. */
            this.esc_state_ = 0;
            this.set_scrolling_region(0, this.ht_ - 1);
            continue;
          case '?':
            /* Special VT100 mode handling. */
            this.esc_state_ = 5;
            this.debug("          special vt100 mode");
            continue;
        }
        // Drop through to next case.
        this.csi_parms_ = [0];
        //this.debug("          set escape state: 3");
        this.esc_state_ = 3;
      case 3: // saw CSI and parameters
        switch (ch) {
          case '0':
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
          case '7':
          case '8':
          case '9':
            x = this.csi_parms_.pop();
            this.csi_parms_.push(x * 10 + ch * 1);
            this.debug("    csi_parms_: " + this.csi_parms_);
            continue;
          case ';':
            if (this.csi_parms_.length < 17)
            this.csi_parms_.push(0);
            continue;
        }
        this.esc_state_ = 0;
        switch (ch) {
          case 'A':
            // Cursor Up 		<ESC>[{COUNT}A
            this.move(this.row_ - Math.max(1, this.csi_parms_[0]),
              this.col_);
            break;
          case 'B':
            // Cursor Down 		<ESC>[{COUNT}B
            this.move(this.row_ + Math.max(1, this.csi_parms_[0]),
              this.col_);
            break;
          case 'C':
            // Cursor Forward 	<ESC>[{COUNT}C
            this.move(this.row_,
              this.col_ + Math.max(1, this.csi_parms_[0]));
            break;
          case 'D':
            // Cursor Backward 	<ESC>[{COUNT}D
            this.move(this.row_,
              this.col_ - Math.max(1, this.csi_parms_[0]));
            break;
          /* TODO: E and F are untested, G and d are not tested thoroughly */
          case 'E':
            // Cursor Next Line
            this.move(this.row_ + Math.max(1, this.csi_parms_[0]),
            0);
            break;
          case 'F':
            // Cursor Previous Line
            this.move(this.row_ - Math.max(1, this.csi_parms_[0]),
            0);
            break;
          case 'G':
            // Cursor Horizontal Absolute
            this.move(this.row_,
              this.csi_parms_[0] - 1);
            break;
          case 'd':
            // Line Position Absolute
            this.move(this.csi_parms_[0] - 1,
              this.col_);
            break;
          case 'f':
          case 'H':
            // Cursor Home 		<ESC>[{ROW};{COLUMN}H
            this.csi_parms_.push(0);
            this.move(this.csi_parms_[0] - 1,
              this.csi_parms_[1] - 1);
            break;
          case 'J':
            switch (this.csi_parms_[0]) {
              case 0:
                this.clrtobot();
                break;
              case 2:
                this.clear();
                this.move(0, 0);
            }
            break;
          case 'm':
            for (j=0; j<this.csi_parms_.length; ++j) {
              x = this.csi_parms_[j];
              if( x > 89 && x < 98 && this.opts.rainbow ){
                const rainbow = this.opts.rainbow
                this.fgset( rainbow[ x % rainbow.length ] )
              }
              switch (x) {
                case 0:
                  this.standend();
                  this.fgset(this.bkgd_.fg);
                  this.bgset(this.bkgd_.bg);
                break;
                case 1:
                  this.attron(VT100.A_BOLD);
                break;
                case 2:
                  this.attroff(VT100.A_BOLD);
                break;
                case 4:
                  this.attron(VT100.A_UNDERLINE);
                break;
                case 5:
                  this.attron(VT100.A_BLINK);
                break;
                case 7:
                  this.attron(VT100.A_REVERSE);
                break;
                case 8:
                  this.attron(VT100.A_INVIS);
                break;
                case 30:
                  this.fgset(VT100.COLOR_BLACK);
                break;
                case 31:
                  this.fgset(VT100.COLOR_RED);
                break;
                case 32:
                  this.fgset(VT100.COLOR_GREEN);
                break;
                case 33:
                  this.fgset(VT100.COLOR_YELLOW);
                break;
                case 34:
                  this.fgset(VT100.COLOR_BLUE);
                break;
                case 35:
                  this.fgset(VT100.COLOR_MAGENTA);
                break;
                case 36:
                  this.fgset(VT100.COLOR_CYAN);
                break;
                case 37:
                  this.fgset(VT100.COLOR_WHITE);
                break;
                case 39:
                  this.fgset(this.bkgd_.fg);
                break;
                case 40:
                  this.bgset(VT100.COLOR_BLACK);
                break;
                case 41:
                  this.bgset(VT100.COLOR_RED);
                break;
                case 42:
                  this.bgset(VT100.COLOR_GREEN);
                break;
                case 43:
                  this.bgset(VT100.COLOR_YELLOW);
                break;
                case 44:
                  this.bgset(VT100.COLOR_BLUE);
                break;
                case 45:
                  this.bgset(VT100.COLOR_MAGENTA);
                break;
                case 46:
                  this.bgset(VT100.COLOR_CYAN);
                break;
                case 47:
                  this.bgset(VT100.COLOR_WHITE);
                break;
                case 49:
                  this.bgset(this.bkgd_.bg);
                break;
              }
            }
            break;
          case 'r':
            // 1,24r - set scrolling region
            this.set_scrolling_region(this.csi_parms_[0] - 1,
              this.csi_parms_[1] - 1);
            break;
          case '[':
            this.debug("           set escape state: 4");
            this.esc_state_ = 4;
            break;
          case 'g':
            // 0g: clear tab at cursor (ignored)
            // 3g: clear all tabs (ignored)
            if (this.csi_parms_[0] == 3)
            this.clear_all();
            break;
          default:
            this.warn("        unknown command: " + ch);
            this.csi_parms_ = [];
            return
            break;
        }
        break;
      case 4: // saw CSI [
        this.esc_state_ = 0; // gobble char.
        break;
      case 5: // Special mode handling, saw <ESC>[?
        // Expect a number - the reset type
        this.csi_parms_ = [ch];
        this.esc_state_ = 6;
        break;
      case 6: // Reset mode handling, saw <ESC>[?1
        // Expect a letter - the mode target, example:
        // <ESC>[?1h : Set cursor key mode to application
        // <ESC>[?3h : Set number of columns to 132
        // <ESC>[?4h : Set smooth scrolling
        // <ESC>[?5h : Set reverse video on screen
        // <ESC>[?6h : Set origin to relative
        // <ESC>[?7h : Set auto-wrap mode
        // <ESC>[?8h : Set auto-repeat mode
        // <ESC>[?9h : Set interlacing mode
        // <ESC>[?1l : Set cursor key mode to cursor
        // <ESC>[?2l : Set VT52 (versus ANSI) compatible
        // <ESC>[?3l : Set number of columns to 80
        // <ESC>[?4l : Set jump scrolling
        // <ESC>[?5l : Set normal video on screen
        // <ESC>[?6l : Set origin to absolute
        // <ESC>[?7l : Reset auto-wrap mode
        // <ESC>[?8l : Reset auto-repeat mode
        // <ESC>[?9l : Reset interlacing mode
        // XXX: Ignored for now.
        //dump("Saw reset mode: <ESC>[?" + this.csi_parms_[0] + ch + "\n");
        if (ch != 'h' && ch != 'l') {
          this.csi_parms_.push(ch);
          continue;
        }
        var command = this.csi_parms_.join('')  + ch;
        if (command == '1h') {
          this.cursor_key_mode_ = VT100.CK_APPLICATION;
        } else if (command == '1l') {
          this.cursor_key_mode_ = VT100.CK_CURSOR;
        }
        this.esc_state_ = 0;
        //this.debug("          set escape state: 0");
        break;
      /*
         * OSC commands (http://invisible-island.net/xterm/ctlseqs/ctlseqs.html)
         * There are two of them:
         * OSC Ps ; Pt ST
         * OSC Ps ; Pt BEL
         *
         * OSC is 0x9d, ST is either 0x9c or 0x1b \
         * esc_state_ == 7		OSC found
         *            == 8		; found
         *            == 9		ESC occured in OSC, awaiting \
         * Ps and Pt are stored in osc_Ps and osc_Pt, respectively
      */
      case 7:
        if (ch == ';') {
          this.debug("           set escape state: 8");
          this.esc_state_ = 8;
        }
        else {
          this.osc_Ps += ch;
        }
        break;
      case 8:
        if (ch == '\x07' || ch == '\x9c') {
          this.esc_state_ = 0;
          //alert(this.osc_Ps + ' ' + this.osc_Pt);
        }
        else if (ch == '\x1b') {
          this.debug("           set escape state: 8");
          this.esc_state_ = 9;
        }
        else {
          this.osc_Pt += ch;
        }
        break;
      case 9:
        if (ch != '\\') {
          this.warn("        unknown command: " + ch)
        } else {
          this.esc_state_ = 0;
          //alert(this.osc_Ps + ' ' + this.osc_Pt);
        }
        break;
      case 10:
        /* Just ignore them for now */
        this.esc_state = 0;
        break;
    }
    if ((prev_esc_state_ > 0 && this.esc_state_ == 0) ||
      (prev_esc_state_ == 0 && this.esc_state_ > 0)) {
      this.info("codes: " + this.escape(codes));
      codes = "";
    }
  }
  this.refresh();
}


VT100.prototype.escape = function VT100_escape(message) {
	var escape_codes = {
		"\r": "\\r",
		"\n": "\\n",
		"\t": "\\t"
	};
	for (var prop in escape_codes) {
		message = message.replace(prop, escape_codes[prop], "g");
	}
	return message;
}

VT100.prototype.debug = function VT100_debug(message) {
	if (this.log_level_ >= VT100.DEBUG) {
		dump(message + "\n");
	}
}

VT100.prototype.info = function VT100_info(message) {
	if (this.log_level_ >= VT100.INFO) {
		dump(message + "\n");
	}
}

VT100.prototype.warn = function VT100_warn(message) {
	if (this.log_level_ >= VT100.WARN) {
		dump(message + "\n");
	}
}

VT100.prototype.throttleSmart = function throttleSmart(fn, wait) {
  let timeout, lastArgs; 
  return (...args) => { 
    lastArgs = lastArgs || []
    if (!timeout) { 
      fn(...args); timeout = setTimeout(() => { fn(...lastArgs); timeout = null; }, wait); 
    } else lastArgs = args; 
  };
}

VT100.prototype.setupTouchInputFallback = function(){
  if( !this.input ){
    this.upload = document.createElement("input")
    this.upload.setAttribute("type", "file")
    this.upload.style.opacity = '0'
    this.upload.style.position = 'absolute'
    this.upload.style.left = '-9999px'

    this.input = document.createElement("input")
    this.input.setAttribute("type", "text")
    this.input.setAttribute("cols", this.opts.cols )
    this.input.setAttribute("rows", this.opts.rows )
    this.input.style.opacity = '0'
    this.input.style.position = 'absolute'
    this.input.style.left = '-9999px'

    this.form  = document.createElement("form")
    this.form.addEventListener("submit", (e) => {
      e.preventDefault()
      this.key_buf_.push('\n')
      setTimeout(VT100.go_getch_, 0);
      return false
    })
    this.form.appendChild(this.upload)
    this.form.appendChild(this.input)
    this.scr_.parentElement.appendChild(this.form)

    this.input.addEventListener('blur', () => {
      if( this.input.value != '' ){
        ch = '\n'
        this.key_buf_.push(ch);
        setTimeout(VT100.go_getch_, 0);
        this.input.value = ''
      }
    })

    this.input.addEventListener("keydown", VT100.handle_onkeypress_, false);

    this.input.handler = (e) => {
      let ch
      let isEnter = String(e?.key).toLowerCase() == "enter" || e?.code == 13 
      let isBackspace = String(e?.key).toLowerCase() == "backspace" || e?.code == 8 
      if( isEnter ){
        ch = '\n'
      }else if( isBackspace ){
        ch = '\b' // naive
      }else{ 
        ch = this.input.value.substr(-1)
      }
      // detect backspace
      if( !ch ) return
      this.key_buf_.push(ch);
      setTimeout(VT100.go_getch_, 0);
      this.input.lastValue = this.input.value
    }
    this.input.addEventListener('input', (e) => this.input.handler(e) ) 

    this.scr_.addEventListener('touchend', (e) => this.focus() )
    this.scr_.addEventListener('click', (e) => this.focus() )
    
  }
  this.useFallbackInput = true
  this.focus()
}

VT100.prototype.focus = function(){
  setTimeout( () => {
    const el = this[ this.useFallbackInput ? 'input' : 'scr_' ]
    el.focus()
  }, 10 )
}

window.keyboard = function(n){
  let msg = 'unknown keyboard'
  if( n == 0 ){
    msg = "using onscreen keyboard"
    VT100.the_vt_.useFallbackInput = true
    VT100.the_vt_.focus()
  }
  if( n == 1 ){
    msg = "using offscreen keyboard"
    VT100.the_vt_.useFallbackInput = false
    VT100.the_vt_.focus()
  }
  return msg
}

function dump(x) {
	// Do nothing
  console.log(x)
}
