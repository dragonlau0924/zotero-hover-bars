/* Hover Bars - bootstrap entry point */

var HoverBars;

async function startup({ id, version, rootURI }) {
	await Zotero.initializationPromise;
	Services.scriptloader.loadSubScript(rootURI + "hover-bars.js");
	HoverBars.init({ id, version, rootURI });
}

function onMainWindowLoad({ window }) {
	HoverBars?.attachMainWindow(window);
}

function onMainWindowUnload({ window }) {
	HoverBars?.detachMainWindow(window);
}

function shutdown() {
	HoverBars?.destroy();
	HoverBars = undefined;
}

function install() {}

function uninstall() {}
