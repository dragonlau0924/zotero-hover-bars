/* Hover Bars - main logic
 *
 * Two bars can be hidden independently. Each one has its own transparent
 * "hover strip" placed where that bar normally sits, so the bars never cover
 * each other:
 *
 *   y = 0 ........ tab bar height ........ + toolbar height
 *       [tab strip]  [toolbar strip]
 *       main window   reader document
 *
 * The strips are real elements laid over the page. This matters: the PDF/EPUB
 * view is a nested document, and mouse events over it never reach the reader's
 * own document, so tracking the pointer position there does not work.
 *
 * All visual changes are one injected <style> per document plus attributes on
 * the document root, so removing the plugin restores the UI completely.
 */

HoverBars = {
	id: null,
	version: null,
	rootURI: null,

	PREF: {
		tab: "extensions.hover-bars.hideTabBar",
		toolbar: "extensions.hover-bars.hideToolbar",
		hover: "extensions.hover-bars.hoverReveal",
	},

	TAB_ZONE_PX: 6, // height of the strip at the very top that reveals the tab bar
	TOOLBAR_ZONE_PX: 14, // height of the strip that reveals the toolbar
	TAB_BAR_FALLBACK_PX: 36, // used if the tab bar height cannot be measured
	HIDE_DELAY_MS: 350,

	FTL_FILE: "hover-bars.ftl",
	STYLE_ID: "hover-bars-style",
	ZONE_ID: "hover-bars-zone",
	HTML_NS: "http://www.w3.org/1999/xhtml",

	STRINGS: {
		en: {
			tab: "Hide Tab Bar",
			toolbar: "Hide Reader Toolbar",
			hover: "Show Hidden Bars on Hover",
		},
		zh: {
			tab: "隐藏顶部标签栏",
			toolbar: "隐藏阅读器工具栏",
			hover: "悬停时显示已隐藏的栏",
		},
	},

	get MAIN_CSS() {
		return `
			:root[hb-tab-hidden] #zotero-title-bar {
				position: absolute !important;
				top: 0;
				left: 0;
				right: 0;
				z-index: 10000;
				transform: translateY(-100%);
				visibility: hidden;
				transition: transform 140ms ease-out, visibility 0s linear 140ms;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
			}
			:root[hb-tab-hidden][hb-reveal] #zotero-title-bar {
				transform: translateY(0);
				visibility: visible;
				transition: transform 140ms ease-out;
			}
			#${this.ZONE_ID} {
				display: none;
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				height: ${this.TAB_ZONE_PX}px;
				z-index: 2147483647;
			}
			:root[hb-tab-hidden]:not([hb-reveal]):not([hb-no-hover]) #${this.ZONE_ID} {
				display: block;
			}
		`;
	},

	get READER_CSS() {
		return `
			:root[hb-toolbar-hidden] .toolbar {
				position: absolute !important;
				top: var(--hb-top, 0px);
				left: 0;
				right: 0;
				z-index: 1000 !important;
				transform: translateY(calc(-100% - var(--hb-top, 0px)));
				visibility: hidden;
				transition: transform 140ms ease-out, visibility 0s linear 140ms;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
			}
			:root[hb-toolbar-hidden][hb-reveal] .toolbar {
				transform: none;
				visibility: visible;
				transition: transform 140ms ease-out;
			}
			:root[hb-toolbar-hidden] #split-view,
			:root[hb-toolbar-hidden] .split-view,
			:root[hb-toolbar-hidden] #sidebarContainer {
				top: 0 !important;
			}
			#${this.ZONE_ID} {
				display: none;
				position: fixed;
				top: var(--hb-top, 0px);
				left: 0;
				right: 0;
				height: ${this.TOOLBAR_ZONE_PX}px;
				z-index: 999;
			}
			:root[hb-toolbar-hidden]:not([hb-reveal]):not([hb-no-hover]) #${this.ZONE_ID} {
				display: block;
			}
		`;
	},

	_menuIDs: [],
	_mainWindows: new Map(), // main window -> AbortController
	_readers: new Map(), // reader iframe document -> { reader, abort }
	_windowListener: null,
	_onRenderToolbar: null,
	_state: {
		tab: { revealed: false, timer: null },
		toolbar: { revealed: false, timer: null },
	},

	/* ================= lifecycle ================= */

	init({ id, version, rootURI }) {
		this.id = id;
		this.version = version;
		this.rootURI = rootURI;

		this._registerMenus();

		this._onRenderToolbar = (event) => {
			try {
				this.attachReader(event.reader, event.doc || event.reader?._iframeWindow?.document);
			}
			catch (e) {
				this.log("renderToolbar handler failed: " + e);
			}
		};
		Zotero.Reader.registerEventListener("renderToolbar", this._onRenderToolbar, this.id);

		// Plugin FTL must be inserted into every window that shows our menu items.
		this._windowListener = {
			onOpenWindow: (xulWindow) => {
				let win = xulWindow.docShell.domWindow;
				win.addEventListener("load", () => this._insertFTL(win), { once: true });
			},
		};
		Services.wm.addListener(this._windowListener);
		for (let win of Services.wm.getEnumerator(null)) {
			this._insertFTL(win);
		}

		for (let win of Zotero.getMainWindows()) {
			this.attachMainWindow(win);
		}
		for (let reader of Zotero.Reader._readers || []) {
			try {
				this.attachReader(reader, reader._iframeWindow?.document);
			}
			catch (e) {
				this.log("could not attach to existing reader: " + e);
			}
		}
	},

	destroy() {
		for (let name of Object.keys(this._state)) {
			this._cancelHide(name);
		}
		for (let menuID of this._menuIDs) {
			try {
				Zotero.MenuManager.unregisterMenu(menuID);
			}
			catch (e) {
				this.log("unregisterMenu failed: " + e);
			}
		}
		this._menuIDs = [];

		if (this._onRenderToolbar) {
			Zotero.Reader.unregisterEventListener("renderToolbar", this._onRenderToolbar);
			this._onRenderToolbar = null;
		}
		if (this._windowListener) {
			Services.wm.removeListener(this._windowListener);
			this._windowListener = null;
		}

		for (let win of [...this._mainWindows.keys()]) {
			this.detachMainWindow(win);
		}
		for (let doc of [...this._readers.keys()]) {
			this._detachReaderDoc(doc);
		}
		for (let win of Services.wm.getEnumerator(null)) {
			try {
				win.document.querySelector(`link[href="${this.FTL_FILE}"]`)?.remove();
			}
			catch (e) {}
		}
	},

	log(msg) {
		Zotero.debug("Hover Bars: " + msg);
	},

	/* ================= preferences & strings ================= */

	getPref(name) {
		let value = Zotero.Prefs.get(this.PREF[name], true);
		if (value === undefined) {
			return name === "hover"; // bars visible and hover-reveal on by default
		}
		return !!value;
	},

	setPref(name, value) {
		Zotero.Prefs.set(this.PREF[name], !!value, true);
		this.applyAll();
	},

	str(name) {
		let lang = String(Zotero.locale || "en-US").startsWith("zh") ? "zh" : "en";
		return this.STRINGS[lang][name];
	},

	/* ================= menu ================= */

	_registerMenus() {
		let makeItem = (name, l10nID) => ({
			menuType: "menuitem",
			l10nID,
			onShowing: (event, context) => {
				let elem = context.menuElem;
				if (!elem) return;
				// Fallback text in case the FTL file was not picked up in this window
				if (!elem.getAttribute("label")) {
					elem.setAttribute("label", this.str(name));
				}
				elem.setAttribute("type", "checkbox");
				elem.checked = this.getPref(name);
				if (name === "tab") {
					// Separate reader windows have no tab bar
					context.setVisible(!!elem.ownerDocument.getElementById("zotero-title-bar"));
				}
			},
			onCommand: () => this.setPref(name, !this.getPref(name)),
		});

		let items = () => [
			{ menuType: "separator" },
			makeItem("tab", "hover-bars-hide-tabbar"),
			makeItem("toolbar", "hover-bars-hide-toolbar"),
			makeItem("hover", "hover-bars-hover-reveal"),
		];

		for (let [menuID, target] of [
			["hover-bars-main-view", "main/menubar/view"],
			["hover-bars-reader-view", "reader/menubar/view"],
		]) {
			let registered = Zotero.MenuManager.registerMenu({
				menuID,
				pluginID: this.id,
				target,
				menus: items(),
			});
			if (registered) {
				this._menuIDs.push(registered);
			}
			else {
				this.log("could not register menu for " + target);
			}
		}
	},

	_insertFTL(win) {
		try {
			win.MozXULElement?.insertFTLIfNeeded(this.FTL_FILE);
		}
		catch (e) {
			this.log("insertFTL failed: " + e);
		}
	},

	/* ================= main window (tab bar) ================= */

	attachMainWindow(win) {
		if (!win || this._mainWindows.has(win) || !win.ZoteroPane) return;
		let doc = win.document;
		this._insertFTL(win);
		this._injectStyle(doc, this.MAIN_CSS);
		let zone = this._createZone(doc);

		let abort = new win.AbortController();
		this._mainWindows.set(win, abort);
		let signal = abort.signal;

		// Pointer enters the strip at the top edge -> slide the tab bar in
		zone.addEventListener("mouseenter", () => {
			if (this.getPref("hover")) this._reveal("tab");
		}, { signal });

		// Pointer over the tab bar keeps it; over anything else lets it go
		doc.addEventListener("mouseover", (e) => {
			if (!this._state.tab.revealed) return;
			if (e.target.closest?.("#zotero-title-bar")) this._cancelHide("tab");
			else this._scheduleHide("tab");
		}, { signal });
		doc.documentElement.addEventListener("mouseleave", () => this._scheduleHide("tab"), { signal });

		// Tab bar height decides where the toolbar sits, keep it current
		win.addEventListener("resize", () => this._refreshToolbarTops(), { signal });

		this._applyMain(win);
	},

	detachMainWindow(win) {
		let abort = this._mainWindows.get(win);
		if (!abort) return;
		abort.abort();
		this._mainWindows.delete(win);
		try {
			let doc = win.document;
			let root = doc.documentElement;
			for (let attr of ["hb-tab-hidden", "hb-reveal", "hb-no-hover"]) {
				root.removeAttribute(attr);
			}
			doc.getElementById(this.ZONE_ID)?.remove();
			doc.getElementById(this.STYLE_ID)?.remove();
			doc.querySelector(`link[href="${this.FTL_FILE}"]`)?.remove();
		}
		catch (e) {
			// Window is already closing
		}
	},

	_applyMain(win) {
		let root = win.document.documentElement;
		root.toggleAttribute("hb-tab-hidden", this.getPref("tab"));
		root.toggleAttribute("hb-no-hover", !this.getPref("hover"));
		root.removeAttribute("hb-reveal");
	},

	/* ================= reader (toolbar) ================= */

	attachReader(reader, doc) {
		if (!doc || !doc.documentElement || this._readers.has(doc)) return;
		let win = doc.defaultView;
		if (!win) return;
		this._pruneReaders();
		this._injectStyle(doc, this.READER_CSS);
		let zone = this._createZone(doc);

		let abort = new win.AbortController();
		this._readers.set(doc, { reader, abort });
		let signal = abort.signal;

		// Pointer enters the strip where the toolbar normally sits -> slide it in
		zone.addEventListener("mouseenter", () => {
			if (this.getPref("hover")) this._reveal("toolbar");
		}, { signal });

		// Pointer over the toolbar keeps it; over the page (or anything else) lets it go
		doc.addEventListener("mouseover", (e) => {
			if (!this._state.toolbar.revealed) return;
			if (e.target.closest?.(".toolbar")) this._cancelHide("toolbar");
			else this._scheduleHide("toolbar");
		}, { signal });
		doc.documentElement.addEventListener("mouseleave", () => this._scheduleHide("toolbar"), { signal });

		this._applyReader(doc);
	},

	_detachReaderDoc(doc) {
		let entry = this._readers.get(doc);
		if (!entry) return;
		try {
			entry.abort.abort();
		}
		catch (e) {}
		this._readers.delete(doc);
		try {
			let root = doc.documentElement;
			for (let attr of ["hb-toolbar-hidden", "hb-reveal", "hb-no-hover"]) {
				root.removeAttribute(attr);
			}
			root.style.removeProperty("--hb-top");
			doc.getElementById(this.ZONE_ID)?.remove();
			doc.getElementById(this.STYLE_ID)?.remove();
		}
		catch (e) {
			// Document is gone
		}
	},

	_pruneReaders() {
		for (let doc of [...this._readers.keys()]) {
			let alive = false;
			try {
				alive = !!doc.defaultView && !doc.defaultView.closed;
			}
			catch (e) {}
			if (!alive) this._readers.delete(doc);
		}
	},

	_applyReader(doc) {
		let root = doc.documentElement;
		root.toggleAttribute("hb-toolbar-hidden", this.getPref("toolbar"));
		root.toggleAttribute("hb-no-hover", !this.getPref("hover"));
		root.removeAttribute("hb-reveal");
		this._refreshToolbarTop(doc);
	},

	/**
	 * Distance from the top of the reader document to where the toolbar sits when shown.
	 * With the tab bar hidden the toolbar keeps its place in the normal layout, right below
	 * the tab bar's height, so the two bars never overlap.
	 */
	_toolbarTop(doc) {
		if (!this.getPref("tab")) return 0;
		let titleBar = this._readers.get(doc)?.reader?._window?.document?.getElementById("zotero-title-bar");
		if (!titleBar) return 0; // separate reader window: there is no tab bar
		let height = titleBar.getBoundingClientRect().height || titleBar.offsetHeight;
		return Math.round(height) || this.TAB_BAR_FALLBACK_PX;
	},

	_refreshToolbarTop(doc) {
		try {
			doc.documentElement.style.setProperty("--hb-top", this._toolbarTop(doc) + "px");
		}
		catch (e) {}
	},

	_refreshToolbarTops() {
		for (let doc of this._readers.keys()) this._refreshToolbarTop(doc);
	},

	_readerPopupOpen() {
		for (let doc of this._readers.keys()) {
			try {
				if (doc.querySelector('.view-popup, .find-popup, .appearance-popup, .context-menu, [class*="popup"], .toolbar input:focus')) {
					return true;
				}
			}
			catch (e) {}
		}
		return false;
	},

	/* ================= reveal / hide ================= */

	_reveal(bar) {
		let state = this._state[bar];
		this._cancelHide(bar);
		if (state.revealed) return;
		state.revealed = true;
		if (bar === "toolbar") this._refreshToolbarTops();
		this._setRevealAttr(bar, true);
	},

	_hide(bar) {
		let state = this._state[bar];
		this._cancelHide(bar);
		state.revealed = false;
		this._setRevealAttr(bar, false);
	},

	_setRevealAttr(bar, on) {
		let roots = bar === "tab"
			? [...this._mainWindows.keys()].map(win => win.document.documentElement)
			: [...this._readers.keys()].map(doc => doc.documentElement);
		for (let root of roots) {
			try {
				root.toggleAttribute("hb-reveal", on);
			}
			catch (e) {}
		}
	},

	_scheduleHide(bar) {
		let state = this._state[bar];
		if (!state.revealed || state.timer) return;
		let win = Zotero.getMainWindow();
		if (!win) return;
		state.timer = win.setTimeout(() => {
			state.timer = null;
			// Keep the toolbar while one of its popups or its search box is in use
			if (bar === "toolbar" && this._readerPopupOpen()) {
				this._scheduleHide(bar);
				return;
			}
			this._hide(bar);
		}, this.HIDE_DELAY_MS);
	},

	_cancelHide(bar) {
		let state = this._state[bar];
		if (!state.timer) return;
		try {
			Zotero.getMainWindow()?.clearTimeout(state.timer);
		}
		catch (e) {}
		state.timer = null;
	},

	/** Re-apply preferences to every window (after a menu toggle). */
	applyAll() {
		this._pruneReaders();
		for (let bar of Object.keys(this._state)) {
			this._hide(bar);
		}
		for (let win of this._mainWindows.keys()) {
			this._applyMain(win);
		}
		for (let doc of this._readers.keys()) {
			this._applyReader(doc);
		}
	},

	/* ================= helpers ================= */

	_injectStyle(doc, css) {
		if (doc.getElementById(this.STYLE_ID)) return;
		let style = doc.createElementNS(this.HTML_NS, "style");
		style.id = this.STYLE_ID;
		style.textContent = css;
		(doc.head || doc.documentElement).appendChild(style);
	},

	_createZone(doc) {
		let existing = doc.getElementById(this.ZONE_ID);
		if (existing) return existing;
		let zone = doc.createElementNS(this.HTML_NS, "div");
		zone.id = this.ZONE_ID;
		(doc.body || doc.documentElement).appendChild(zone);
		return zone;
	},
};
