{{flutter_js}}
{{flutter_build_config}}

// The local preview keeps the same HTML shell between builds. Version the
// Flutter entrypoint so an updated driver bundle cannot remain in browser/SW
// cache after a web rebuild.
if (_flutter.buildConfig?.builds) {
  _flutter.buildConfig.builds = _flutter.buildConfig.builds.map((build) => ({
    ...build,
    mainJsPath: build.mainJsPath
      ? `${build.mainJsPath}?v=20261114-driver-startup-fix-2`
      : build.mainJsPath,
  }));
}

const sarcaLoader = document.getElementById('sarca-loader');
const sarcaLoaderMessage = document.getElementById('sarca-loader-message');

const hideSarcaLoader = () => {
  sarcaLoader?.classList.add('is-hidden');
};

window.addEventListener('flutter-first-frame', hideSarcaLoader);
window.addEventListener('error', () => {
  if (sarcaLoaderMessage) {
    sarcaLoaderMessage.textContent =
      'Ainda estamos a ligar os servicos. Se demorar muito, recarrega a pagina.';
  }
});

_flutter.loader.load({
  onEntrypointLoaded: async (engineInitializer) => {
    if (sarcaLoaderMessage) {
      sarcaLoaderMessage.textContent =
        'O SARCA Motorista esta a terminar de preparar a interface.';
    }
    const appRunner = await engineInitializer.initializeEngine();
    await appRunner.runApp();
  },
});
