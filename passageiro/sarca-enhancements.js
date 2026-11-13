(function () {
  'use strict';

  // The key is intentionally used only by the Web build. Restrict it in the
  // OpenWeather dashboard to the SARCA domain before publishing this artifact.
  var OPENWEATHER_KEY = '__OPENWEATHER_API_KEY__';
  var SARCA_SUPABASE_URL = 'https://tpmsgvkdjzoidvyiwwfk.supabase.co';
  var SARCA_SUPABASE_KEY = 'sb_publishable_VPBqfA_NVrvTs3fRqA49iw_NdOhXRTC';
  var SARCA_MAPBOX_TOKEN = '__SARCA_MAPBOX_TOKEN__';
  var weather = { loading: true, temperature: null, minimum: null, maximum: null, label: 'A pedir localização', rain: false, updatedAt: null, scope: 'A tua zona', locationRequired: false };
  var card;
  var rainLayer;
  var heatDialog;
  var negotiationChoice = 'suggested';
  var negotiationProposedFare = '';
  var lastPreviewPayload = null;
  var lastPreviewRequest = null;
  var mapDashboardSummaryLock = false;
  var mapDashboardSummaryKeepAlive = null;
  var lastCurrentLocation = null;
  var pickupUsesCurrentLocation = false;
  var CURRENT_LOCATION_STORAGE_KEY = 'sarCa.current-location.v1';
  var lastDestinationSelection = null;
  var destinationSearchRequestId = 0;
  var destinationSearchTimer = null;
  var destinationSearchAbortController = null;
  var destinationSearchCache = Object.create(null);
  var lastAuthHeader = null;
  var requestInFlight = false;
  // All rider mutations use a keyed client-side lane. A second tap on the
  // same action is ignored until the first request settles.
  var riderActionInFlight = Object.create(null);
  function beginRiderAction(key) {
    var actionKey = String(key || '').trim();
    if (!actionKey || riderActionInFlight[actionKey]) return false;
    riderActionInFlight[actionKey] = true;
    return true;
  }
  function endRiderAction(key) {
    var actionKey = String(key || '').trim();
    if (actionKey) delete riderActionInFlight[actionKey];
  }
  var voiceMode = 'voice';
  var voiceTimer = null;
  var voicePending = null;
  var voiceLastEvent = null;
  var voiceAudio = null;
  var voiceAssetBase = 'assets/sarCa/voice/';
  var nearbyDriversCard = null;
  var nearbyDriversTimer = null;
  var tripTrackingTimer = null;
  var tripTrackingTripId = null;
  var tripTrackingInFlight = false;
  var waitDisplayTimer = null;
  var lastNearbyDrivers = [];
  var lastNearbyUpdatedAt = null;
  var lastLiveRoute = null;
  var liveRouteRequestAt = 0;
  var liveMapOverlay = null;
  var liveMapOverlaySvg = null;
  var fullMapSurface = null;
  var fullMapCanvas = null;
  var fullMap = null;
  var passengerCameraFollowing = true;
  var passengerCameraButton = null;
  var passengerCameraAnimationFrame = null;
  var passengerCameraTripKey = '';
  var passengerCameraNeedsInitialFit = true;
  var passengerCameraLastCenter = null;
  var passengerCameraLastMoveAt = 0;
  var fullMapViewportKey = '';
  var assignedDriverMarker = null;
  var assignedDriverAnimationFrame = null;
  var assignedDriverOverlay = null;
  var assignedDriverOverlayMoveBound = false;
  var riderLocationMarker = null;
  var fullMapInitStarted = false;
  var fullMapRouteSourceId = 'sarCa-passenger-route';
  var fullMapManeuverSourceId = 'sarCa-route-maneuvers';
  var fullMapRecordedRouteSourceId = 'sarCa-recorded-route';
  var fullMapDestinationSourceId = 'sarCa-trip-destination';
  var fullMapPeopleSourceId = 'sarCa-live-people';
  var mapDashboardShell = null;
  var mapDashboardPanel = null;
  var mapDashboardPickupInput = null;
  var mapDashboardDestinationInput = null;
  var mapDashboardLocationButton = null;
  var mapDashboardRouteAction = null;
  var mapDashboardService = 'trip';
  var mapDashboardServiceClass = '';
  var mapDashboardCategoryChoice = null;
  var mapDashboardCategoryQuotes = Object.create(null);
  var mapDashboardCategoryPriceState = 'idle';
  var mapDashboardCategoryPriceKey = '';
  var mapDashboardCategoryPriceRequestId = 0;
  var mapDashboardDeliveryDetails = null;
  var mapDashboardPickupReferenceInput = null;
  var mapDashboardDeliveryReferenceInput = null;
  var mapDashboardPackageDescriptionInput = null;
  var mapDashboardPackageSizeSelect = null;
  var mapDashboardRecipientNameInput = null;
  var mapDashboardRecipientPhoneInput = null;
  var mapDashboardTripsView = null;
  var mapDashboardProfileView = null;
  var mapDashboardProfileSheet = null;
  var openTripDetailsKey = '';
  var mapDashboardProfilePhone = '';
  var mapDashboardProfileUserId = '';
  var mapDashboardProfileAvatarUrl = '';
  var walletRefreshTimer = null;
  var passengerWalletBalance = null;
  var passengerWalletCurrency = 'MZN';
  var authReturnTimer = null;
  var riderLocationWatchId = null;
  var riderLocationPublishTimer = null;
  var lastRiderLocationPublishedAt = 0;
  var riderNotificationButton = null;
  var riderNotificationPollTimer = null;
  var riderNotificationInitialized = false;
  var riderNotificationKnownIds = Object.create(null);
  var riderNotificationRows = [];
  var riderCompletionRefreshInFlight = Object.create(null);
  var riderCompletionRefreshRetryTimers = Object.create(null);
  var riderActiveTab = 'home';
  var localPriorityPlacesPromise = null;
  var localPriorityPlaces = [];

  function rememberCurrentLocation(location) {
    if (!location || !isFinite(Number(location.latitude)) || !isFinite(Number(location.longitude))) return;
    var stored = {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      label: String(location.label || 'Localização atual'),
      updatedAt: new Date().toISOString()
    };
    try {
      window.__SARCA_CURRENT_LOCATION__ = stored;
      window.localStorage.setItem(CURRENT_LOCATION_STORAGE_KEY, JSON.stringify(stored));
    } catch (_) {}
    updateMapDashboardLocationLabel(stored.label);
    syncFullMapSurface();
  }

  (function primeStoredLocation() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(CURRENT_LOCATION_STORAGE_KEY) || 'null');
      if (stored && isFinite(Number(stored.latitude)) && isFinite(Number(stored.longitude))) {
        window.__SARCA_CURRENT_LOCATION__ = stored;
        lastCurrentLocation = stored;
        pickupUsesCurrentLocation = true;
      }
    } catch (_) {}
  }());

  function fullMapImageUrl(location) {
    var latitude = Number(location && location.latitude);
    var longitude = Number(location && location.longitude);
    if (!isFinite(latitude) || !isFinite(longitude)) {
      latitude = -25.9692;
      longitude = 32.5732;
    }
    return 'https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/' + longitude + ',' + latitude + ',13,0/1280x900?access_token=' + encodeURIComponent(SARCA_MAPBOX_TOKEN);
  }

  function fitFullMapToPassengerPoints(location, destination, extraPoint) {
    if (!fullMap || !location) return;
    var fitPoints = [location];
    if (destination && isFinite(Number(destination.latitude)) && isFinite(Number(destination.longitude))) fitPoints.push(destination);
    if (extraPoint && isFinite(Number(extraPoint.latitude)) && isFinite(Number(extraPoint.longitude))) fitPoints.push(extraPoint);
    if (destination && Array.isArray(destination.routePoints)) {
      destination.routePoints.forEach(function (point) {
        if (point && isFinite(Number(point.latitude)) && isFinite(Number(point.longitude))) fitPoints.push(point);
      });
    }
    if (fitPoints.length > 1) {
      var minLng = Math.min.apply(null, fitPoints.map(function (point) { return Number(point.longitude); }));
      var maxLng = Math.max.apply(null, fitPoints.map(function (point) { return Number(point.longitude); }));
      var minLat = Math.min.apply(null, fitPoints.map(function (point) { return Number(point.latitude); }));
      var maxLat = Math.max.apply(null, fitPoints.map(function (point) { return Number(point.latitude); }));
      var bounds = [[minLng, minLat], [maxLng, maxLat]];
      var viewportKey = fitPoints.map(function (point) {
        return (Math.round(Number(point.longitude) * 1000) / 1000) + ',' + (Math.round(Number(point.latitude) * 1000) / 1000);
      }).join('|');
      if (viewportKey === fullMapViewportKey) return;
      fullMapViewportKey = viewportKey;
      try { fullMap.resize(); } catch (_) {}
      try { fullMap.fitBounds(bounds, { padding: { top: 110, right: 28, bottom: 290, left: 28 }, maxZoom: 16.2, duration: 450 }); } catch (_) {}
      return;
    }
    var pointKey = (Math.round(Number(location.longitude) * 1000) / 1000) + ',' + (Math.round(Number(location.latitude) * 1000) / 1000);
    if (pointKey === fullMapViewportKey) return;
    fullMapViewportKey = pointKey;
    try { fullMap.easeTo({ center: [Number(location.longitude), Number(location.latitude)], zoom: 15.5, duration: 450 }); } catch (_) {}
  }

  function activePassengerTrip(payload) {
    var trip = payload && payload.trip;
    if (!trip) return null;
    var status = String(trip.status || '');
    return ['driver_assigned', 'driver_arriving', 'in_progress'].indexOf(status) >= 0 ? trip : null;
  }

  function driverPresenceAgeSeconds(presence) {
    if (!presence) return null;
    var updatedAt = presence.updatedAt || presence.updated_at || presence.recordedAt || presence.recorded_at || presence.locationUpdatedAt || presence.location_updated_at;
    if (!updatedAt) return null;
    var updatedMs = Date.parse(String(updatedAt));
    if (!isFinite(updatedMs)) return null;
    return Math.max(0, (Date.now() - updatedMs) / 1000);
  }

  function driverLocationStatus(payload) {
    if (navigator.onLine === false) return 'A actualizar localização…';
    var presence = getAssignedDriverPresence(payload);
    var ageSeconds = driverPresenceAgeSeconds(presence);
    if (ageSeconds != null && ageSeconds > 45) return 'A actualizar localização…';
    return 'Localização do motorista actualizada';
  }

  function setPassengerCameraFollowing(following) {
    passengerCameraFollowing = !!following;
    if (passengerCameraButton) {
      passengerCameraButton.hidden = passengerCameraFollowing || !activePassengerTrip(lastTripPayload);
    }
  }

  function pausePassengerCamera(event) {
    if (!activePassengerTrip(lastTripPayload) || !passengerCameraFollowing) return;
    // Mapbox emits originalEvent for gestures. Programmatic easeTo/fitBounds
    // events do not carry one, so automatic camera movement never disables
    // following by accident.
    if (event && event.originalEvent == null && event.type !== 'dragstart') return;
    try { if (fullMap) fullMap.stop(); } catch (_) {}
    setPassengerCameraFollowing(false);
  }

  function ensurePassengerCameraButton() {
    if (passengerCameraButton) return;
    passengerCameraButton = document.createElement('button');
    passengerCameraButton.type = 'button';
    passengerCameraButton.className = 'sarCa-passenger-recenter-button';
    passengerCameraButton.textContent = 'Recentralizar';
    passengerCameraButton.setAttribute('aria-label', 'Recentralizar no motorista e na rota');
    passengerCameraButton.hidden = true;
    passengerCameraButton.addEventListener('click', function () {
      passengerCameraCameraReset();
    });
    document.body.appendChild(passengerCameraButton);
  }

  function passengerCameraCameraReset() {
    setPassengerCameraFollowing(true);
    passengerCameraNeedsInitialFit = true;
    if (lastTripPayload) followPassengerCamera(lastTripPayload, true);
  }

  function passengerCameraZoom(payload, target) {
    var presence = getAssignedDriverPresence(payload);
    var driverLat = presenceLatitude(presence);
    var driverLng = presenceLongitude(presence);
    var distance = driverLat == null || driverLng == null || !target
      ? 2
      : distanceKmBetween(driverLat, driverLng, target.latitude, target.longitude);
    var speed = Number(presence && (presence.speedKmh || presence.speed_kmh || presence.speed));
    if (isFinite(speed) && speed > 80) return 14.0;
    if (distance > 10) return 14.2;
    if (distance > 5) return 14.8;
    if (distance > 2) return 15.5;
    if (distance > .7) return 16.2;
    return 16.8;
  }

  function followPassengerCamera(payload, force) {
    var trip = activePassengerTrip(payload);
    var presence = getAssignedDriverPresence(payload);
    if (!fullMap || !trip || !presence) {
      if (passengerCameraButton) passengerCameraButton.hidden = true;
      return;
    }
    if (!passengerCameraFollowing && !force) {
      if (passengerCameraButton) passengerCameraButton.hidden = false;
      return;
    }
    var driverLat = presenceLatitude(presence);
    var driverLng = presenceLongitude(presence);
    if (driverLat == null || driverLng == null) return;
    var status = String(trip.status || '');
    var target = status === 'in_progress'
      ? { latitude: tripLatitude(trip, 'dropoff'), longitude: tripLongitude(trip, 'dropoff') }
      : { latitude: tripLatitude(trip, 'pickup'), longitude: tripLongitude(trip, 'pickup') };
    if (target.latitude == null || target.longitude == null ||
        !isFinite(Number(target.latitude)) || !isFinite(Number(target.longitude))) return;
    var tripKey = String(trip.id || '') + ':' + status;
    if (tripKey !== passengerCameraTripKey) {
      passengerCameraTripKey = tripKey;
      passengerCameraNeedsInitialFit = true;
    }
    if (passengerCameraButton) passengerCameraButton.hidden = passengerCameraFollowing;
    var driverPoint = [Number(driverLng), Number(driverLat)];
    var targetPoint = [Number(target.longitude), Number(target.latitude)];
    var cameraKey = tripKey + ':' +
      Math.round(Number(driverLng) * 10000) / 10000 + ',' +
      Math.round(Number(driverLat) * 10000) / 10000 + '>' +
      Math.round(Number(target.longitude) * 10000) / 10000 + ',' +
      Math.round(Number(target.latitude) * 10000) / 10000;
    var now = Date.now();
    if (!force && !passengerCameraNeedsInitialFit &&
        passengerCameraLastCenter === cameraKey &&
        now - passengerCameraLastMoveAt < 1800) return;
    if (!force && !passengerCameraNeedsInitialFit && now - passengerCameraLastMoveAt < 700) return;
    passengerCameraLastCenter = cameraKey;
    passengerCameraLastMoveAt = now;
    try {
      if (passengerCameraNeedsInitialFit || force) {
        fullMap.fitBounds([driverPoint, targetPoint], {
          padding: { top: 110, right: 28, bottom: 250, left: 28 },
          maxZoom: 16.3,
          duration: 550,
        });
        passengerCameraNeedsInitialFit = false;
        return;
      }
      fullMap.easeTo({
        center: driverPoint,
        zoom: passengerCameraZoom(payload, target),
        bearing: 0,
        pitch: 0,
        offset: [0, 110],
        duration: 650,
        essential: true,
      });
    } catch (_) {}
  }

  function removeAssignedDriverMarker() {
    if (assignedDriverAnimationFrame) {
      try { cancelAnimationFrame(assignedDriverAnimationFrame); } catch (_) {}
      assignedDriverAnimationFrame = null;
    }
    if (assignedDriverMarker) {
      try { assignedDriverMarker.remove(); } catch (_) {}
    }
    assignedDriverMarker = null;
    if (assignedDriverOverlay && assignedDriverOverlay.parentNode) assignedDriverOverlay.parentNode.removeChild(assignedDriverOverlay);
    assignedDriverOverlay = null;
    assignedDriverOverlayMoveBound = false;
  }

  function removeRiderLocationMarker() {
    if (riderLocationMarker) {
      try { riderLocationMarker.remove(); } catch (_) {}
    }
    riderLocationMarker = null;
  }

  function syncRiderLocationMarker(location) {
    if (!fullMap || !window.mapboxgl || !location ||
        !isFinite(Number(location.latitude)) || !isFinite(Number(location.longitude))) {
      removeRiderLocationMarker();
      return;
    }
    if (!riderLocationMarker) {
      var markerElement = document.createElement('div');
      markerElement.className = 'sarCa-rider-location-marker';
      markerElement.setAttribute('aria-label', 'Passageiro');
      markerElement.innerHTML = '<span aria-hidden="true"><i>👤</i></span>';
      riderLocationMarker = new window.mapboxgl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([Number(location.longitude), Number(location.latitude)])
        .addTo(fullMap);
    } else {
      riderLocationMarker.setLngLat([Number(location.longitude), Number(location.latitude)]);
    }
  }

  function syncAssignedDriverMarker(activeTrip, assignedDriver, hasArrived, isStale) {
    if (!fullMap || !window.mapboxgl || !activeTrip || !assignedDriver ||
        !isFinite(Number(assignedDriver.latitude)) || !isFinite(Number(assignedDriver.longitude))) {
      removeAssignedDriverMarker();
      return;
    }
    var target = [Number(assignedDriver.longitude), Number(assignedDriver.latitude)];
    if (!assignedDriverMarker) {
      var markerElement = document.createElement('div');
      markerElement.className = 'sarCa-assigned-driver-marker';
      markerElement.innerHTML = '<span aria-hidden="true"><i>🚗</i></span>';
      markerElement.setAttribute('aria-label', hasArrived ? 'Motorista chegou ao ponto de recolha' : 'Motorista a caminho');
      assignedDriverMarker = new window.mapboxgl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat(target)
        .addTo(fullMap);
    }
    var markerElement = assignedDriverMarker.getElement ? assignedDriverMarker.getElement() : null;
    if (markerElement) {
      markerElement.classList.toggle('is-arrived', !!hasArrived);
      markerElement.classList.toggle('is-stale', !!isStale);
      markerElement.setAttribute('aria-label', hasArrived ? 'Motorista chegou ao ponto de recolha' : 'Motorista a caminho');
      markerElement.title = hasArrived ? 'Motorista chegou ao ponto de recolha' : 'Motorista a caminho';
      markerElement.style.setProperty('--sarCa-heading', (Number(assignedDriver.heading) || 0) + 'deg');
    }
    var current = assignedDriverMarker.getLngLat ? assignedDriverMarker.getLngLat() : null;
    var from = current ? [Number(current.lng), Number(current.lat)] : target;
    if (!isFinite(from[0]) || !isFinite(from[1]) ||
        (Math.abs(from[0] - target[0]) < 0.000001 && Math.abs(from[1] - target[1]) < 0.000001)) {
      assignedDriverMarker.setLngLat(target);
      return;
    }
    if (assignedDriverAnimationFrame) {
      try { cancelAnimationFrame(assignedDriverAnimationFrame); } catch (_) {}
    }
    var startedAt = performance.now();
    var duration = 850;
    var animate = function (now) {
      if (!assignedDriverMarker) return;
      var progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
      var eased = progress * (2 - progress);
      assignedDriverMarker.setLngLat([
        from[0] + (target[0] - from[0]) * eased,
        from[1] + (target[1] - from[1]) * eased,
      ]);
      if (progress < 1) assignedDriverAnimationFrame = requestAnimationFrame(animate);
      else assignedDriverAnimationFrame = null;
    };
    assignedDriverAnimationFrame = requestAnimationFrame(animate);
  }

  function syncFullMapMapObjects() {
    if (!fullMap || !window.mapboxgl) return;
    var liveTrip = lastTripPayload && lastTripPayload.trip;
    var activeTrip = liveTrip && !['completed', 'cancelled', 'cancelled_by_driver', 'no_driver_found', 'payment_pending'].includes(String(liveTrip.status || ''));
    // Once a trip exists, its server-confirmed destination is authoritative.
    // Do not reuse a stale local search result after a refresh or a restored
    // session, otherwise the map can draw the previous trip's route.
    var destination = lastDestinationSelection || null;
    if (activeTrip) {
      var liveTripStatus = String(liveTrip.status || '');
      var serverDestinationLatitude = liveTripStatus === 'in_progress'
        ? tripLatitude(liveTrip, 'dropoff')
        : tripLatitude(liveTrip, 'pickup');
      var serverDestinationLongitude = liveTripStatus === 'in_progress'
        ? tripLongitude(liveTrip, 'dropoff')
        : tripLongitude(liveTrip, 'pickup');
      if (serverDestinationLatitude != null && serverDestinationLongitude != null) {
        // Before boarding, the authoritative route is driver -> pickup. Do
        // not draw the complete pickup -> destination route in that phase.
        var serverRoutePoints = liveTripStatus === 'in_progress' && Array.isArray(liveTrip.planned_route)
          ? liveTrip.planned_route.map(function (point) {
              return { latitude: Number(point.latitude), longitude: Number(point.longitude) };
            }).filter(function (point) { return isFinite(point.latitude) && isFinite(point.longitude); })
          : [];
        destination = {
          label: liveTripStatus === 'in_progress'
            ? (liveTrip.dropoff_address || liveTrip.dropoffAddress || 'Destino confirmado')
            : (liveTrip.pickup_address || liveTrip.pickupAddress || 'Ponto de recolha'),
          latitude: serverDestinationLatitude,
          longitude: serverDestinationLongitude,
          routePoints: serverRoutePoints,
        };
      }
    }
    // Após a atribuição, a rota recalculada pelo servidor/Mapbox substitui a
    // pesquisa antiga no mapa. Isto evita uma segunda linha SVG desalinhada.
    if (activeTrip && lastLiveRoute && Array.isArray(lastLiveRoute.points) && lastLiveRoute.points.length >= 2 && destination) {
      destination.routePoints = lastLiveRoute.points.map(function (point) {
        return { longitude: Number(point[0]), latitude: Number(point[1]) };
      }).filter(function (point) { return isFinite(point.latitude) && isFinite(point.longitude); });
    }
    var location = lastCurrentLocation || window.__SARCA_CURRENT_LOCATION__ || null;
    if (!location && liveTrip) {
      var confirmedPickupLat = tripLatitude(liveTrip, 'pickup');
      var confirmedPickupLng = tripLongitude(liveTrip, 'pickup');
      if (confirmedPickupLat != null && confirmedPickupLng != null) {
        location = {
          latitude: confirmedPickupLat,
          longitude: confirmedPickupLng,
          label: 'A tua localização / recolha confirmada',
        };
      }
    }
    if (!fullMap.isStyleLoaded || !fullMap.isStyleLoaded()) return;

    var validPoint = function (point) {
      return point && isFinite(Number(point.latitude)) && isFinite(Number(point.longitude));
    };
    var assignedPresence = getAssignedDriverPresence(lastTripPayload);
    var assignedDriver = assignedPresence ? {
      latitude: presenceLatitude(assignedPresence),
      longitude: presenceLongitude(assignedPresence),
      heading: presenceHeading(assignedPresence),
    } : null;
    // Durante a viagem iniciada, manter apenas o motorista no mapa reduz a
    // ambiguidade. O ponto do passageiro continua guardado no estado da
    // viagem, mas deixa de competir visualmente com a rota em andamento.
    if (activeTrip && String(liveTrip.status || '') === 'in_progress') removeRiderLocationMarker();
    else syncRiderLocationMarker(location);
    var tripWait = lastTripPayload && lastTripPayload.wait;
    var tripStatus = liveTrip ? String(liveTrip.status || '') : '';
    var driverHasArrived = activeTrip && tripStatus === 'driver_arriving' && tripWait && tripWait.state === 'active';
    if (activeTrip && assignedDriver) {
      syncAssignedDriverMarker(
        activeTrip,
        assignedDriver,
        driverHasArrived,
        driverPresenceAgeSeconds(assignedPresence) > 45,
      );
    }
    else removeAssignedDriverMarker();

    // Keep one authoritative GeoJSON layer for actual GPS positions. Pickup
    // and destination are never represented as people or vehicle positions.
    var peopleFeatures = [];
    if (!activeTrip) {
      (Array.isArray(lastNearbyDrivers) ? lastNearbyDrivers : []).slice(0, 8).forEach(function (driver) {
        var point = { latitude: driver.currentLat, longitude: driver.currentLng };
        if (!validPoint(point)) return;
        peopleFeatures.push({
          type: 'Feature',
          properties: { kind: 'driver', label: 'Motorista disponível' },
          geometry: { type: 'Point', coordinates: [Number(point.longitude), Number(point.latitude)] },
        });
      });
    }
    var peopleSource = fullMap.getSource(fullMapPeopleSourceId);
    if (!peopleSource) {
      try {
        fullMap.addSource(fullMapPeopleSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: peopleFeatures },
        });
        fullMap.addLayer({
          id: fullMapPeopleSourceId + '-drivers',
          type: 'circle',
          source: fullMapPeopleSourceId,
          filter: ['==', ['get', 'kind'], 'driver'],
          paint: {
            'circle-radius': 9,
            'circle-color': '#16a34a',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          },
        });
        fullMap.addLayer({
          id: fullMapPeopleSourceId + '-rider',
          type: 'circle',
          source: fullMapPeopleSourceId,
          filter: ['==', ['get', 'kind'], 'rider'],
          paint: {
            'circle-radius': 11,
            'circle-color': '#7c3aed',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          },
        });
        fullMap.addLayer({
          id: fullMapPeopleSourceId + '-driver-labels',
          type: 'symbol',
          source: fullMapPeopleSourceId,
          filter: ['==', ['get', 'kind'], 'driver'],
          layout: {
            'text-field': '',
            'text-size': 11,
            'text-offset': [0, -1.8],
            'text-anchor': 'bottom',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#06182b',
            'text-halo-width': 2,
          },
        });
        fullMap.addLayer({
          id: fullMapPeopleSourceId + '-rider-labels',
          type: 'symbol',
          source: fullMapPeopleSourceId,
          filter: ['==', ['get', 'kind'], 'rider'],
          layout: {
            'text-field': '',
            'text-size': 11,
            'text-offset': [0, -1.8],
            'text-anchor': 'bottom',
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#06182b',
            'text-halo-width': 2,
          },
        });
        peopleSource = fullMap.getSource(fullMapPeopleSourceId);
      } catch (_) { return; }
    }
    if (peopleSource) peopleSource.setData({ type: 'FeatureCollection', features: peopleFeatures });
    if (validPoint(location) && !activeTrip) {
      try {
        var center = [Number(location.longitude), Number(location.latitude)];
        if (destination && isFinite(Number(destination.latitude)) && isFinite(Number(destination.longitude))) {
          fitFullMapToPassengerPoints(location, destination, assignedDriver);
        } else {
          fullMap.easeTo({ center: center, zoom: Math.max(Number(fullMap.getZoom() || 15), 15.2), duration: 250 });
        }
      } catch (_) {}
    }

    var source = fullMap.getSource(fullMapRouteSourceId);
    if (!source) {
      try {
        fullMap.addSource(fullMapRouteSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        fullMap.addLayer({
          id: fullMapRouteSourceId,
          type: 'line',
          source: fullMapRouteSourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#1769ff', 'line-width': 5, 'line-opacity': 0.9 },
        });
        source = fullMap.getSource(fullMapRouteSourceId);
      } catch (_) { return; }
    }
    var coordinates = [];
    if (destination && location) {
      coordinates = Array.isArray(destination.routePoints) && destination.routePoints.length >= 2
        ? destination.routePoints.map(function (point) { return [Number(point.longitude), Number(point.latitude)]; })
        : [];
    }
    source.setData(coordinates.length >= 2 ? {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: coordinates },
    } : { type: 'FeatureCollection', features: [] });

    // A polyline calculated by Mapbox is the planned route. The real route
    // travelled by the driver comes from sarca.trip_route_points through the
    // live-tracking function. Keep it visually quieter and never invent
    // points when the backend has not sent them yet.
    var recordedRouteSource = fullMap.getSource(fullMapRecordedRouteSourceId);
    if (!recordedRouteSource) {
      try {
        fullMap.addSource(fullMapRecordedRouteSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        fullMap.addLayer({
          id: fullMapRecordedRouteSourceId,
          type: 'line',
          source: fullMapRecordedRouteSourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#64748b',
            'line-width': 4,
            'line-opacity': 0.58,
            'line-dasharray': [1.2, 1.2],
          },
        });
        recordedRouteSource = fullMap.getSource(fullMapRecordedRouteSourceId);
      } catch (_) {}
    }
    var recordedRoute = activeTrip && lastTripPayload && Array.isArray(lastTripPayload.routeHistory)
      ? lastTripPayload.routeHistory.map(function (point) {
          return [Number(point.longitude != null ? point.longitude : point.lng), Number(point.latitude != null ? point.latitude : point.lat)];
        }).filter(function (point) { return isFinite(point[0]) && isFinite(point[1]); })
      : [];
    if (recordedRouteSource) {
      recordedRouteSource.setData(recordedRoute.length >= 2 ? {
        type: 'Feature',
        properties: { kind: 'recorded-route' },
        geometry: { type: 'LineString', coordinates: recordedRoute },
      } : { type: 'FeatureCollection', features: [] });
    }

    // During an in-progress trip, keep an explicit destination marker. The
    // passenger marker is intentionally removed at this phase, so the only
    // people marker left on the map is the assigned driver.
    var destinationSource = fullMap.getSource(fullMapDestinationSourceId);
    if (!destinationSource) {
      try {
        fullMap.addSource(fullMapDestinationSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        fullMap.addLayer({
          id: fullMapDestinationSourceId + '-point',
          type: 'circle',
          source: fullMapDestinationSourceId,
          paint: {
            'circle-radius': 8,
            'circle-color': '#1769ff',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 3,
          },
        });
        fullMap.addLayer({
          id: fullMapDestinationSourceId + '-label',
          type: 'symbol',
          source: fullMapDestinationSourceId,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-offset': [0, 1.6],
            'text-anchor': 'top',
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#06182b',
            'text-halo-width': 2,
          },
        });
        destinationSource = fullMap.getSource(fullMapDestinationSourceId);
      } catch (_) {}
    }
    var destinationFeature = null;
    if (activeTrip && String(liveTrip.status || '') === 'in_progress' && destination && validPoint(destination)) {
      destinationFeature = {
        type: 'Feature',
        properties: { label: 'Destino' },
        geometry: { type: 'Point', coordinates: [Number(destination.longitude), Number(destination.latitude)] },
      };
    }
    if (destinationSource) {
      destinationSource.setData(destinationFeature
        ? { type: 'FeatureCollection', features: [destinationFeature] }
        : { type: 'FeatureCollection', features: [] });
    }

    var maneuverSource = fullMap.getSource(fullMapManeuverSourceId);
    if (!maneuverSource) {
      try {
        fullMap.addSource(fullMapManeuverSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        fullMap.addLayer({
          id: fullMapManeuverSourceId,
          type: 'symbol',
          source: fullMapManeuverSourceId,
          layout: {
            'text-field': ['get', 'icon'],
            'text-size': 18,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#1769ff',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2,
          },
        });
        maneuverSource = fullMap.getSource(fullMapManeuverSourceId);
      } catch (_) {}
    }
    if (maneuverSource) {
      var maneuverFeatures = activeTrip && lastLiveRoute && Array.isArray(lastLiveRoute.maneuvers)
        ? lastLiveRoute.maneuvers.filter(function (maneuver) {
            return maneuver && maneuver.type !== 'depart' && maneuver.type !== 'arrive' && Number(maneuver.distanceFromStartMeters) >= 20 && Array.isArray(maneuver.location);
          }).slice(0, 4).map(function (maneuver) {
            return {
              type: 'Feature',
              properties: {
                icon: maneuver.icon || '↑',
                instruction: maneuverDisplayText(maneuver),
              },
              geometry: { type: 'Point', coordinates: maneuver.location },
            };
          })
        : [];
      maneuverSource.setData({ type: 'FeatureCollection', features: maneuverFeatures });
    }
    if (activeTrip && assignedDriver) followPassengerCamera(lastTripPayload);
  }

  function syncFullMapSurface() {
    var location = lastCurrentLocation || window.__SARCA_CURRENT_LOCATION__ || null;
    if (fullMapSurface) fullMapSurface.style.backgroundImage = 'url("' + fullMapImageUrl(location) + '")';
    syncFullMapMapObjects();
    if (!fullMap || !location) return;
    var latitude = Number(location.latitude);
    var longitude = Number(location.longitude);
    if (!isFinite(latitude) || !isFinite(longitude)) return;
    var assignedPresence = getAssignedDriverPresence(lastTripPayload);
    var assignedDriver = assignedPresence ? {
      latitude: presenceLatitude(assignedPresence),
      longitude: presenceLongitude(assignedPresence),
    } : null;
    if (activePassengerTrip(lastTripPayload) && assignedDriver) {
      followPassengerCamera(lastTripPayload);
    } else {
      fitFullMapToPassengerPoints(location, lastDestinationSelection, assignedDriver);
    }
  }

  function initFullMapSurfaceMap() {
    if (!fullMapCanvas || fullMap || !window.mapboxgl) return;
    try {
      window.mapboxgl.accessToken = SARCA_MAPBOX_TOKEN;
      fullMap = new window.mapboxgl.Map({
        container: fullMapCanvas,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [32.5732, -25.9692],
        zoom: 15,
        attributionControl: false,
        dragPan: true,
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
        keyboard: true,
      });
      window.__SARCA_FULL_MAP__ = fullMap;
      fullMap.on('dragstart', pausePassengerCamera);
      fullMap.on('zoomstart', pausePassengerCamera);
      fullMap.on('rotatestart', pausePassengerCamera);
      fullMap.on('pitchstart', pausePassengerCamera);
      fullMap.on('load', syncFullMapSurface);
      ensurePassengerCameraButton();
    } catch (_) {
      fullMap = null;
    }
  }

  function installFullMapSurface() {
    if (fullMapSurface) return;
    var surface = document.createElement('div');
    surface.id = 'sarCa-full-map-surface';
    surface.setAttribute('aria-hidden', 'true');
    surface.style.backgroundImage = 'url("' + fullMapImageUrl(null) + '")';
    var canvas = document.createElement('div');
    canvas.id = 'sarCa-full-map-canvas';
    surface.appendChild(canvas);
    document.body.appendChild(surface);
    fullMapSurface = surface;
    fullMapCanvas = canvas;
    if (window.mapboxgl) {
      initFullMapSurfaceMap();
    } else if (!document.getElementById('sarCa-mapbox-gl-js')) {
      var stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css';
      document.head.appendChild(stylesheet);
      var script = document.createElement('script');
      script.id = 'sarCa-mapbox-gl-js';
      script.async = true;
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js';
      script.onload = initFullMapSurfaceMap;
      document.head.appendChild(script);
    }
  }

  function updateMapDashboardLocationLabel(label) {
    var target = document.getElementById('sarCa-map-dashboard-location-label');
    if (target) {
      if (String(target.tagName || '').toLowerCase() === 'input') target.value = String(label || 'Localização atual');
      else target.textContent = String(label || 'Localização atual');
    }
    if (mapDashboardPickupInput && mapDashboardPickupInput !== target) {
      mapDashboardPickupInput.value = String(label || 'Localização atual');
    }
  }

  function setMapDashboardService(service) {
    mapDashboardService = service === 'delivery' ? 'delivery' : 'trip';
    mapDashboardServiceClass = '';
    if (!mapDashboardPanel) return;
    mapDashboardPanel.querySelectorAll('[data-sarca-service]').forEach(function (button) {
      var active = button.dataset.sarcaService === mapDashboardService;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    if (mapDashboardDestinationInput) {
      mapDashboardDestinationInput.placeholder = mapDashboardService === 'delivery' ? 'Para onde vai a entrega?' : 'Para onde vais?';
      mapDashboardDestinationInput.setAttribute('aria-label', mapDashboardService === 'delivery' ? 'Destino da entrega' : 'Destino da viagem');
    }
    if (mapDashboardDeliveryDetails) mapDashboardDeliveryDetails.hidden = mapDashboardService !== 'delivery';
    updateMapDashboardCategoryChoice();
  }

  var MAP_DASHBOARD_CATEGORIES = [
    { id: 'economico', icon: '🚗', label: 'Económico' },
    { id: 'conforto', icon: '🚘', label: 'Conforto' },
    { id: 'moto', icon: '🏍️', label: 'Moto' },
    { id: 'txopela', icon: '🛺', label: 'Txopela' },
  ];

  function categoryQuoteAmount(quote) {
    if (!quote) return null;
    var value = quote.estimatedFare;
    if (value == null) value = quote.estimated_fare;
    if (value == null) value = quote.totalFare;
    if (value == null) value = quote.total_fare;
    if (value == null && quote.pricing) value = quote.pricing.totalFare || quote.pricing.finalFare;
    var amount = Number(value);
    return isFinite(amount) && amount > 0 ? amount : null;
  }

  function getMapDashboardCategoryPriceKey() {
    if (!lastDestinationSelection || !lastCurrentLocation) return '';
    return [
      lastDestinationSelection.placeId || lastDestinationSelection.label,
      Number(lastDestinationSelection.distanceKm || 0).toFixed(3),
      Number(lastDestinationSelection.durationSeconds || 0).toFixed(0),
      Number(lastCurrentLocation.latitude || 0).toFixed(5),
      Number(lastCurrentLocation.longitude || 0).toFixed(5),
    ].join('|');
  }

  function updateMapDashboardCategoryChoice() {
    if (!mapDashboardCategoryChoice) return;
    var ready = !!(lastDestinationSelection && Array.isArray(lastDestinationSelection.routePoints) && lastDestinationSelection.routePoints.length >= 2);
    mapDashboardCategoryChoice.hidden = !ready;
    mapDashboardCategoryChoice.querySelectorAll('[data-sarca-category]').forEach(function (button) {
      var active = button.dataset.sarcaCategory === mapDashboardServiceClass;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      var quote = mapDashboardCategoryQuotes[button.dataset.sarcaCategory];
      var price = button.querySelector('[data-sarca-category-price]');
      var availability = button.querySelector('[data-sarca-category-availability]');
      var nearbyDriverCount = quote && Number(
        quote.nearbyDriverCount != null ? quote.nearbyDriverCount : quote.nearby_driver_count
      );
      if (price) price.textContent = !ready
        ? 'Aguardando rota'
        : mapDashboardCategoryPriceState === 'loading'
          ? 'A calcular…'
          : quote && categoryQuoteAmount(quote) != null
            ? '≈ ' + money(categoryQuoteAmount(quote))
            : mapDashboardCategoryPriceState === 'error'
              ? 'Indisponível'
              : 'A consultar';
      if (availability) {
        availability.classList.remove('is-ready', 'is-empty');
        if (!ready) {
          availability.textContent = 'Confirma origem e destino';
        } else if (mapDashboardCategoryPriceState === 'loading') {
          availability.textContent = 'A verificar disponibilidade…';
        } else if (quote && Number.isFinite(nearbyDriverCount) && nearbyDriverCount > 0) {
          availability.classList.add('is-ready');
          availability.textContent = nearbyDriverCount === 1
            ? '1 motorista próximo'
            : nearbyDriverCount + ' motoristas próximos';
        } else if (quote && categoryQuoteAmount(quote) != null) {
          availability.classList.add('is-empty');
          availability.textContent = 'Disponibilidade após confirmar o pedido';
        } else if (mapDashboardCategoryPriceState === 'error') {
          availability.textContent = 'Disponibilidade indisponível';
        } else {
          availability.textContent = 'A consultar disponibilidade';
        }
      }
      button.disabled = !!(ready && (!quote || categoryQuoteAmount(quote) == null));
    });
    var hint = mapDashboardCategoryChoice.querySelector('.sarCa-map-dashboard-category-hint');
    if (hint) hint.textContent = ready
      ? mapDashboardCategoryPriceState === 'loading'
        ? 'A consultar os preços reais das categorias…'
        : mapDashboardCategoryPriceState === 'error'
          ? 'Não foi possível carregar os preços. Inicia sessão e tenta novamente.'
          : (mapDashboardService === 'delivery' ? 'Compara os preços e escolhe o meio da entrega.' : 'Compara os preços e escolhe o tipo de transporte.')
      : 'Primeiro confirma a origem e escolhe um destino.';
    if (mapDashboardRouteAction) {
      var selectedQuote = mapDashboardCategoryQuotes[mapDashboardServiceClass];
      var selectedAmount = categoryQuoteAmount(selectedQuote);
      mapDashboardRouteAction.hidden = !ready || !mapDashboardServiceClass || selectedAmount == null;
      mapDashboardRouteAction.textContent = selectedAmount == null
        ? 'ESCOLHE UMA CATEGORIA'
        : 'CONTINUAR COM ' + (MAP_DASHBOARD_CATEGORIES.find(function (entry) { return entry.id === mapDashboardServiceClass; }) || {}).label + ' · ' + money(selectedAmount);
    }
  }

  function collectCategoryQuotes(payload) {
    var quotes = Object.create(null);
    var offers = payload && Array.isArray(payload.offers) ? payload.offers : [];
    offers.forEach(function (offer) {
      var serviceClass = String(offer && (offer.serviceClass || offer.service_class) || '').trim().toLowerCase();
      if (!MAP_DASHBOARD_CATEGORIES.some(function (entry) { return entry.id === serviceClass; })) return;
      if (categoryQuoteAmount(offer) != null) quotes[serviceClass] = offer;
    });
    if (payload && payload.pricing && categoryQuoteAmount(payload.pricing) != null && !quotes.economico) quotes.economico = payload.pricing;
    return quotes;
  }

  async function fetchCategoryPreview(serviceClass) {
    var request = requestFromMapDashboardRoute(serviceClass);
    if (!request) throw new Error('Rota incompleta');
    var headers = { 'Content-Type': 'application/json', apikey: SARCA_SUPABASE_KEY };
    var authHeader = lastAuthHeader || loadStoredAuthHeader();
    headers.Authorization = authHeader || 'Bearer ' + SARCA_SUPABASE_KEY;
    var response = await window.fetch(SARCA_SUPABASE_URL + '/functions/v1/preview-trip-offers', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(request),
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar os preços.');
    return payload;
  }

  async function loadMapDashboardCategoryPrices() {
    var key = getMapDashboardCategoryPriceKey();
    if (!key || mapDashboardCategoryPriceKey === key && mapDashboardCategoryPriceState === 'loading') return;
    if (mapDashboardCategoryPriceKey === key && mapDashboardCategoryPriceState === 'ready') {
      updateMapDashboardCategoryChoice();
      return;
    }
    var requestId = ++mapDashboardCategoryPriceRequestId;
    mapDashboardCategoryPriceKey = key;
    mapDashboardCategoryQuotes = Object.create(null);
    mapDashboardCategoryPriceState = 'loading';
    updateMapDashboardCategoryChoice();
    try {
      var firstPayload = await fetchCategoryPreview('economico');
      if (requestId !== mapDashboardCategoryPriceRequestId) return;
      mapDashboardCategoryQuotes = collectCategoryQuotes(firstPayload);
      var missing = MAP_DASHBOARD_CATEGORIES.map(function (entry) { return entry.id; }).filter(function (id) {
        return categoryQuoteAmount(mapDashboardCategoryQuotes[id]) == null;
      });
      if (missing.length) {
        var extraPayloads = await Promise.all(missing.map(function (id) {
          return fetchCategoryPreview(id).catch(function () { return null; });
        }));
        extraPayloads.forEach(function (payload) {
          var extraQuotes = collectCategoryQuotes(payload);
          Object.keys(extraQuotes).forEach(function (id) { mapDashboardCategoryQuotes[id] = extraQuotes[id]; });
        });
      }
      mapDashboardCategoryPriceState = MAP_DASHBOARD_CATEGORIES.some(function (entry) {
        return categoryQuoteAmount(mapDashboardCategoryQuotes[entry.id]) != null;
      }) ? 'ready' : 'error';
    } catch (_) {
      if (requestId === mapDashboardCategoryPriceRequestId) mapDashboardCategoryPriceState = 'error';
    }
    if (requestId === mapDashboardCategoryPriceRequestId) updateMapDashboardCategoryChoice();
  }

  function setMapDashboardCategory(serviceClass) {
    var allowed = MAP_DASHBOARD_CATEGORIES.map(function (entry) { return entry.id; });
    if (allowed.indexOf(serviceClass) === -1 || categoryQuoteAmount(mapDashboardCategoryQuotes[serviceClass]) == null) return;
    mapDashboardServiceClass = serviceClass;
    updateMapDashboardCategoryChoice();
  }

  function resetDestinationSelectionForEditing() {
    lastDestinationSelection = null;
    mapDashboardServiceClass = '';
    mapDashboardCategoryQuotes = Object.create(null);
    mapDashboardCategoryPriceState = 'idle';
    mapDashboardCategoryPriceKey = '';
    mapDashboardCategoryPriceRequestId++;
    updateMapDashboardCategoryChoice();
    syncFullMapSurface();
  }

  function requestFromMapDashboardRoute(serviceClassOverride) {
    var requestedServiceClass = serviceClassOverride || mapDashboardServiceClass;
    if (!lastCurrentLocation || !lastDestinationSelection || !requestedServiceClass) return null;
    var request = {
      pickupAddress: lastCurrentLocation.label || 'Localização atual',
      dropoffAddress: lastDestinationSelection.label,
      pickupLat: Number(lastCurrentLocation.latitude),
      pickupLng: Number(lastCurrentLocation.longitude),
      dropoffLat: Number(lastDestinationSelection.latitude),
      dropoffLng: Number(lastDestinationSelection.longitude),
      distanceKm: Number(lastDestinationSelection.distanceKm || 0),
      durationSeconds: Number(lastDestinationSelection.durationSeconds || 0),
      routePoints: lastDestinationSelection.routePoints || [],
      city: 'Maputo',
      paymentMethod: 'cash',
      serviceClass: requestedServiceClass,
      serviceType: mapDashboardService === 'delivery' ? 'delivery' : 'ride',
    };
    if (mapDashboardService === 'delivery') {
      var pickupReference = String(mapDashboardPickupReferenceInput && mapDashboardPickupReferenceInput.value || '').trim();
      var deliveryReference = String(mapDashboardDeliveryReferenceInput && mapDashboardDeliveryReferenceInput.value || '').trim();
      var packageDescription = String(mapDashboardPackageDescriptionInput && mapDashboardPackageDescriptionInput.value || '').trim();
      var packageSize = String(mapDashboardPackageSizeSelect && mapDashboardPackageSizeSelect.value || '').trim();
      var recipientName = String(mapDashboardRecipientNameInput && mapDashboardRecipientNameInput.value || '').trim();
      var recipientPhone = String(mapDashboardRecipientPhoneInput && mapDashboardRecipientPhoneInput.value || '').trim();
      var deliveryNote = ['Entrega SARCA', packageDescription ? 'Conteúdo: ' + packageDescription : '', packageSize ? 'Tamanho: ' + packageSize : '', deliveryReference ? 'Referência de entrega: ' + deliveryReference : ''].filter(Boolean).join(' · ');
      request.requestedForName = recipientName || null;
      request.requestedForPhone = recipientPhone || null;
      request.requestedForRelationship = recipientName || recipientPhone ? 'destinatário' : null;
      request.passengerNote = deliveryNote || null;
      request.pickupAccessPoint = {
        label: pickupReference || 'Ponto de recolha confirmado',
        latitude: request.pickupLat,
        longitude: request.pickupLng,
        confirmed: true,
        service_type: 'delivery',
        package_description: packageDescription || null,
        package_size: packageSize || null,
        recipient_name: recipientName || null,
        recipient_phone: recipientPhone || null,
        delivery_reference: deliveryReference || null,
      };
    }
    return request;
  }

  async function prepareMapDashboardPreview() {
    if (!mapDashboardRouteAction || requestInFlight) return;
    var request = requestFromMapDashboardRoute();
    if (!request) {
      renderCurrentLocationStatus('Escolhe primeiro uma categoria para continuar.', 'error');
      updateMapDashboardCategoryChoice();
      return;
    }

    // The category cards already loaded a valid preview for this exact route.
    // Re-requesting it here made the Continue button stay in a loading state
    // on WebView devices, even though the prices were already available. Use
    // the cached offers to open the confirmation summary immediately; the
    // authenticated request is sent only by the final confirmation button.
    if (mapDashboardCategoryPriceState === 'ready' &&
        Object.keys(mapDashboardCategoryQuotes).length > 0) {
      mapDashboardSummaryLock = true;
      lastPreviewRequest = request;
      lastPreviewPayload = {
        route: {
          pickupAddress: request.pickupAddress,
          dropoffAddress: request.dropoffAddress,
          pickupLat: request.pickupLat,
          pickupLng: request.pickupLng,
          dropoffLat: request.dropoffLat,
          dropoffLng: request.dropoffLng,
          distanceKm: request.distanceKm,
          durationSeconds: request.durationSeconds,
          routePoints: request.routePoints,
        },
        offers: Object.keys(mapDashboardCategoryQuotes).map(function (key) {
          return mapDashboardCategoryQuotes[key];
        }),
        pricing: mapDashboardCategoryQuotes[mapDashboardServiceClass] || mapDashboardCategoryQuotes.economico || {},
        payment: { selectedMethod: 'cash', options: [{ method: 'cash', available: true }] },
        previewOnly: true,
      };
      renderPaymentToll(lastPreviewPayload);
      if (mapDashboardPanel) mapDashboardPanel.classList.add('is-summary');
      keepMapDashboardSummaryVisible();
      return;
    }
    requestInFlight = true;
    mapDashboardRouteAction.disabled = true;
    mapDashboardRouteAction.textContent = 'A calcular categorias e preços…';
    try {
      var headers = { 'Content-Type': 'application/json', apikey: SARCA_SUPABASE_KEY };
      headers.Authorization = lastAuthHeader || loadStoredAuthHeader() || 'Bearer ' + SARCA_SUPABASE_KEY;
      var response = await window.fetch(SARCA_SUPABASE_URL + '/functions/v1/preview-trip-offers', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(request),
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || 'Não foi possível preparar o pedido agora.');
      lastPreviewRequest = request;
      lastPreviewPayload = payload;
      // The network bridge renders this preview exactly once. Rendering here
      // as well caused the summary to be rebuilt twice on every calculation.
      if (mapDashboardPanel) mapDashboardPanel.classList.add('is-summary');
    } catch (error) {
      mapDashboardRouteAction.disabled = false;
      mapDashboardRouteAction.textContent = 'VER PREÇO E CONTINUAR';
      renderCurrentLocationStatus('⚠️ ' + (error && error.message ? error.message : 'Não foi possível preparar o pedido.'), 'error');
    } finally {
      requestInFlight = false;
    }
  }

  function showMapDashboardRouteAction() {
    updateMapDashboardCategoryChoice();
  }

  function renderMapDashboardTab(tab) {
    if (!mapDashboardPanel) return;
    var title = mapDashboardPanel.querySelector('h2');
    var description = mapDashboardPanel.querySelector('p');
    var home = mapDashboardPanel.querySelector('.sarCa-map-dashboard-home');
    var serviceChoice = mapDashboardPanel.querySelector('.sarCa-map-dashboard-service-choice');
    var isHome = tab === 'home';
    mapDashboardPanel.classList.toggle('is-history', tab === 'trips');
    mapDashboardPanel.classList.toggle('is-profile', tab === 'profile');
    // A viagem ativa pode esconder o painel inicial para não tapar o mapa,
    // mas nunca pode esconder as abas que o passageiro abriu deliberadamente.
    if (!isHome) {
      mapDashboardPanel.classList.remove('is-trip-active');
    } else if (lastTripPayload && lastTripPayload.trip) {
      var activeTabStatuses = ['searching_driver', 'offered_to_driver', 'driver_assigned', 'driver_arriving', 'in_progress'];
      mapDashboardPanel.classList.toggle('is-trip-active', activeTabStatuses.indexOf(String(lastTripPayload.trip.status || '')) !== -1);
    }
    if (serviceChoice) serviceChoice.hidden = !isHome;
    if (mapDashboardRouteAction) {
      mapDashboardRouteAction.hidden = !isHome || !lastDestinationSelection || !mapDashboardServiceClass;
      if (!isHome) {
        mapDashboardRouteAction.disabled = false;
        mapDashboardRouteAction.textContent = 'VER PREÇO E CONTINUAR';
      }
    }
    if (mapDashboardTripsView) mapDashboardTripsView.hidden = tab !== 'trips';
    if (mapDashboardProfileView) mapDashboardProfileView.hidden = tab !== 'profile';
    if (tab === 'trips') {
      if (title) title.textContent = 'Viagens concluídas';
      if (description) description.textContent = 'Só aparecem viagens terminadas com sucesso. Abre uma para veres todos os detalhes.';
      if (home) home.hidden = true;
      loadMapDashboardTripsView();
    } else if (tab === 'profile') {
      if (title) title.textContent = 'O teu perfil';
      if (description) description.textContent = 'Dados pessoais, carteira e definições do SARCA.';
      if (home) home.hidden = true;
      loadMapDashboardProfileData();
    } else {
      if (title) title.textContent = 'Olá! Para onde vais?';
      if (description) description.textContent = 'Escolhe a localização e o destino sem sair do mapa.';
      if (home) home.hidden = false;
    }
  }

  function loadMapDashboardProfileData() {
    var authorization = lastAuthHeader || loadStoredAuthHeader();
    if (!authorization) return;
    var headers = { apikey: SARCA_SUPABASE_KEY, Authorization: authorization };
    // The profile request is the first reliable signal that the restored
    // Supabase session is ready. Trigger trip recovery on the next task so
    // the trip cards created later in boot already exist when the response
    // arrives; the interval below remains as a safety net for slow sessions.
    window.setTimeout(function () {
      restoreActivePassengerTrip();
    }, 0);
    fetch(SARCA_SUPABASE_URL + '/auth/v1/user', { headers: headers }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (user) {
      if (!user) return null;
      mapDashboardProfileUserId = String(user.id || '');
      var metadata = user.user_metadata || {};
      mapDashboardProfileAvatarUrl = String(metadata.avatar_url || metadata.avatarUrl || '');
      renderMapDashboardProfileAvatar(mapDashboardProfileAvatarUrl);
      var profileName = document.getElementById('sarCa-profile-name');
      var profilePhone = document.getElementById('sarCa-profile-phone');
      if (profileName) profileName.textContent = String(metadata.full_name || metadata.name || 'Conta SARCA');
      mapDashboardProfilePhone = String(user.phone || '');
      if (profilePhone) profilePhone.textContent = String(user.phone || 'Número ainda não disponível');
      var query = encodeURIComponent('user_id=eq.' + user.id + '&select=full_name,phone,role,avatar_url');
      return fetch(SARCA_SUPABASE_URL + '/rest/v1/profiles?' + query, { headers: headers }).then(function (response) {
        return response.ok ? response.json() : [];
      }).then(function (rows) {
        var profile = Array.isArray(rows) ? rows[0] : null;
        if (!profile) return;
        if (profileName && profile.full_name) profileName.textContent = profile.full_name;
        if (profilePhone && profile.phone) profilePhone.textContent = profile.phone;
        if (profile.phone) mapDashboardProfilePhone = String(profile.phone);
        if (profile.avatar_url) {
          mapDashboardProfileAvatarUrl = String(profile.avatar_url);
          renderMapDashboardProfileAvatar(mapDashboardProfileAvatarUrl);
        }
        var role = document.getElementById('sarCa-profile-role');
        if (role && profile.role) role.textContent = profile.role === 'passenger' ? 'Passageiro' : profile.role;
      });
    }).catch(function () {});
    fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-get-my-wallet-summary', { headers: headers }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      if (!payload) return;
      if (payload.profile) {
        if (payload.profile.full_name) {
          var walletProfileName = document.getElementById('sarCa-profile-name');
          if (walletProfileName) walletProfileName.textContent = String(payload.profile.full_name);
        }
        if (payload.profile.phone) mapDashboardProfilePhone = String(payload.profile.phone);
        if (payload.profile.avatar_url) {
          mapDashboardProfileAvatarUrl = String(payload.profile.avatar_url);
          renderMapDashboardProfileAvatar(mapDashboardProfileAvatarUrl);
        }
      }
      var wallets = Array.isArray(payload.wallets) ? payload.wallets : [];
      var available = wallets.find(function (wallet) { return wallet.account_type === 'available' || wallet.type === 'available'; }) || wallets[0];
      var balance = available && (available.computed_balance != null ? available.computed_balance : available.balance);
      if (balance != null && isFinite(Number(balance))) passengerWalletBalance = Number(balance);
      if (available && (available.currency || available.currency_code)) passengerWalletCurrency = String(available.currency || available.currency_code);
      var balanceElement = document.getElementById('sarCa-profile-wallet-balance');
      var walletCount = document.getElementById('sarCa-profile-wallet-count');
      var tripCountElement = document.getElementById('sarCa-profile-trip-count');
      var ratingCountElement = document.getElementById('sarCa-profile-rating-count');
      if (balanceElement && balance != null) balanceElement.textContent = Number(balance).toFixed(2) + ' ' + String((available && (available.currency || available.currency_code)) || 'MZN');
      if (walletCount) walletCount.textContent = String(wallets.length || '--');
      if (tripCountElement && payload.tripCount != null) tripCountElement.textContent = String(payload.tripCount);
      var ratingCount = payload.ratingCount != null
        ? payload.ratingCount
        : payload.profile && payload.profile.rating_count != null
          ? payload.profile.rating_count
          : null;
      if (ratingCountElement && ratingCount != null) ratingCountElement.textContent = String(ratingCount);
    }).catch(function () {});
    loadMapDashboardTripCount(headers);
    fetch(SARCA_SUPABASE_URL + '/rest/v1/rpc/get_my_rating_summary', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: '{}' }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (summary) {
      if (!summary) return;
      var ratingCountElement = document.getElementById('sarCa-profile-rating-count');
      var ratingCount = summary.ratingCount != null ? summary.ratingCount : summary.rating_count;
      if (ratingCountElement && ratingCount != null) ratingCountElement.textContent = String(ratingCount);
    }).catch(function () {});
  }

  function scheduleWalletRefresh() {
    if (walletRefreshTimer) window.clearInterval(walletRefreshTimer);
    var attempts = 0;
    walletRefreshTimer = window.setInterval(function () {
      attempts += 1;
      loadMapDashboardProfileData();
      if (attempts >= 20) {
        window.clearInterval(walletRefreshTimer);
        walletRefreshTimer = null;
      }
    }, 3000);
  }

  function fetchPassengerWalletBalance() {
    var accessToken = readAccessToken();
    if (!accessToken) return Promise.reject(new Error('Sessão necessária'));
    return fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-get-my-wallet-summary', {
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'apikey': SARCA_SUPABASE_KEY,
      },
    }).then(function (response) {
      return response.ok ? response.json() : response.json().catch(function () { return {}; }).then(function () { throw new Error('Não foi possível consultar o saldo da carteira.'); });
    }).then(function (payload) {
      var wallets = Array.isArray(payload && payload.wallets) ? payload.wallets : [];
      var available = wallets.find(function (wallet) { return wallet.account_type === 'available' || wallet.type === 'available'; }) || wallets[0];
      var balance = available && (available.computed_balance != null ? available.computed_balance : available.balance);
      if (balance == null || !isFinite(Number(balance))) throw new Error('Não foi possível consultar o saldo da carteira.');
      passengerWalletBalance = Number(balance);
      if (available && (available.currency || available.currency_code)) passengerWalletCurrency = String(available.currency || available.currency_code);
      return passengerWalletBalance;
    });
  }

  function renderMapDashboardProfileAvatar(avatarUrl) {
    var avatar = document.getElementById('sarCa-profile-avatar');
    if (!avatar) return;
    avatar.innerHTML = '';
    if (!avatarUrl) {
      avatar.textContent = '👤';
      return;
    }
    var image = document.createElement('img');
    var imageSource = String(avatarUrl);
    if (/^https?:\/\//i.test(imageSource)) imageSource += (imageSource.indexOf('?') >= 0 ? '&' : '?') + 'sarCaAvatar=' + Date.now();
    image.src = imageSource;
    image.alt = 'Foto do perfil';
    image.loading = 'lazy';
    image.onerror = function () { avatar.textContent = '👤'; };
    avatar.appendChild(image);
  }

  function verifyProfileAvatarUrl(avatarUrl) {
    return new Promise(function (resolve, reject) {
      var probe = new Image();
      probe.onload = function () { resolve(avatarUrl); };
      probe.onerror = function () { reject(new Error('A foto foi carregada, mas não ficou visível. Tenta uma foto JPG, PNG ou WebP.')); };
      var source = String(avatarUrl || '');
      if (/^https?:\/\//i.test(source)) source += (source.indexOf('?') >= 0 ? '&' : '?') + 'sarCaVerify=' + Date.now();
      probe.src = source;
    });
  }

  function loadMapDashboardTripCount(headers) {
    var countElement = document.getElementById('sarCa-profile-trip-count');
    if (!countElement) return;
    fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-list-my-trips?limit=50', { headers: headers }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      if (!payload) return;
      var trips = Array.isArray(payload.trips) ? payload.trips : [];
      var completed = trips.filter(function (trip) { return String(trip.status || '').toLowerCase() === 'completed'; });
      countElement.textContent = String(completed.length);
    }).catch(function () {});
  }

  function loadMapDashboardTripsView() {
    if (!mapDashboardTripsView) return;
    var authorization = lastAuthHeader || loadStoredAuthHeader();
    if (!authorization) {
      mapDashboardTripsView.innerHTML = '';
      mapDashboardTripsView.appendChild(el('div', 'sarCa-map-dashboard-tab-icon', '🚗'));
      mapDashboardTripsView.appendChild(el('strong', '', 'Entra para ver as tuas viagens'));
      mapDashboardTripsView.appendChild(el('span', '', 'O histórico fica ligado à tua conta SARCA.'));
      return;
    }
    mapDashboardTripsView.innerHTML = '';
    mapDashboardTripsView.appendChild(el('div', 'sarCa-map-dashboard-tab-icon', '⏳'));
    mapDashboardTripsView.appendChild(el('strong', '', 'A carregar as tuas viagens…'));
    var headers = { apikey: SARCA_SUPABASE_KEY, Authorization: authorization };
    fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-list-my-trips?limit=50', { headers: headers }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      if (!payload) throw new Error('Não foi possível carregar o histórico.');
      var trips = (Array.isArray(payload.trips) ? payload.trips : []).filter(function (trip) {
        return String(trip && trip.status || '').toLowerCase() === 'completed';
      });
      mapDashboardTripsView.innerHTML = '';
      if (!trips.length) {
        mapDashboardTripsView.appendChild(el('div', 'sarCa-map-dashboard-tab-icon', '🚗'));
        mapDashboardTripsView.appendChild(el('strong', '', 'Ainda não há viagens concluídas com sucesso'));
        mapDashboardTripsView.appendChild(el('span', '', 'Viagens canceladas ou incompletas não aparecem aqui. Quando terminares uma viagem, abre-a para veres o recibo e todos os detalhes.'));
        return;
      }

      function textValue(value, fallback) {
        var text = value == null ? '' : String(value).trim();
        return text || fallback || 'Não registado';
      }

      function firstValue(object, keys, fallback) {
        for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
          var value = object && object[keys[keyIndex]];
          if (value != null && String(value).trim() !== '') return value;
        }
        return fallback;
      }

      function formatTripDate(value) {
        if (!value) return 'Não registado';
        var date = new Date(value);
        return isNaN(date.getTime()) ? textValue(value, 'Não registado') : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      }

      function formatTripDuration(seconds) {
        var value = Number(seconds);
        if (!isFinite(value) || value < 0) return 'Não registada';
        var minutes = Math.max(0, Math.round(value / 60));
        return minutes < 1 ? 'Menos de 1 min' : minutes + ' min';
      }

      function formatTripDistance(trip) {
        var meters = Number(firstValue(trip, ['distance_meters'], null));
        if (isFinite(meters) && meters > 0) return (meters / 1000).toFixed(2) + ' km';
        var kilometres = Number(firstValue(trip, ['distance_km'], null));
        return isFinite(kilometres) && kilometres > 0 ? kilometres.toFixed(2) + ' km' : 'Não registada';
      }

      function formatTripPayment(method) {
        var normalized = String(method || '').toLowerCase();
        if (normalized === 'cash' || normalized === 'dinheiro') return 'Dinheiro';
        if (normalized === 'wallet' || normalized === 'mobile_wallet' || normalized === 'carteira') return 'Carteira móvel';
        return textValue(method, 'Não registado');
      }

      function addTripDetailRow(container, label, value, extraClass) {
        var row = el('div', 'sarCa-map-dashboard-trip-detail-row' + (extraClass ? ' ' + extraClass : ''));
        row.appendChild(el('span', '', label));
        row.appendChild(el('strong', '', textValue(value, 'Não registado')));
        container.appendChild(row);
      }

      function renderTripDetails(container, trip, trackingPayload) {
        container.innerHTML = '';
        var driverSource = Object.assign({},
          trip.driver_details || {},
          trip.driverDetails || {},
          trackingPayload && trackingPayload.driver_details || {},
          trackingPayload && trackingPayload.driverDetails || {}
        );
        var driver = normalizedDriverDetails(driverSource);
        var origin = firstValue(trip, ['pickup_address', 'pickup_label', 'origin_label', 'origin_address'], 'Origem confirmada');
        var destination = firstValue(trip, ['dropoff_address', 'destination_label', 'destination_address', 'dropoff_label'], 'Destino confirmado');
        var fare = minorOrAmount(trip, 'final_fare_minor', 'final_fare') || minorOrAmount(trip, 'agreed_fare_minor', 'agreed_fare') || minorOrAmount(trip, 'estimated_fare_minor', 'estimated_fare');
        var toll = minorOrAmount(trip, 'toll_amount_minor', 'toll_amount');
        var driverName = firstValue(driver, ['fullName', 'full_name', 'name'], firstValue(trip, ['driver_name', 'driver_full_name'], driver ? 'Motorista SARCA' : 'A carregar…'));
        var vehicle = driver ? [driver.vehicleMake || driver.vehicle_make, driver.vehicleModel || driver.vehicle_model, driver.vehicleColor || driver.vehicle_color].filter(Boolean).join(' · ') : '';
        var summary = el('div', 'sarCa-map-dashboard-trip-details-section');
        summary.appendChild(el('strong', 'sarCa-map-dashboard-trip-details-title', 'Resumo da viagem'));
        addTripDetailRow(summary, 'Rota', String(origin) + ' → ' + String(destination), 'sarCa-map-dashboard-trip-route');
        addTripDetailRow(summary, 'Motorista', driverName);
        if (driver && driver.phone) addTripDetailRow(summary, 'Contacto', driver.phone);
        if (vehicle) addTripDetailRow(summary, 'Viatura', vehicle);
        if (driver && driver.plateNumber) addTripDetailRow(summary, 'Matrícula', driver.plateNumber);
        addTripDetailRow(summary, 'Valor pago', fare ? money(fare) : 'Não registado');
        addTripDetailRow(summary, 'Forma de pagamento', formatTripPayment(trip.payment_method));
        if (toll) addTripDetailRow(summary, 'Portagens', money(toll));
        addTripDetailRow(summary, 'Distância', formatTripDistance(trip));
        addTripDetailRow(summary, 'Duração', formatTripDuration(firstValue(trip, ['duration_seconds'], null)));
        addTripDetailRow(summary, 'Pedido em', formatTripDate(firstValue(trip, ['requested_at', 'created_at'], null)));
        addTripDetailRow(summary, 'Aceite em', formatTripDate(trip.accepted_at));
        addTripDetailRow(summary, 'Iniciada em', formatTripDate(trip.started_at));
        addTripDetailRow(summary, 'Concluída em', formatTripDate(firstValue(trip, ['completed_at', 'ended_at'], null)));
        addTripDetailRow(summary, 'ID da viagem', trip.id);
        container.appendChild(summary);
        var coordinates = el('div', 'sarCa-map-dashboard-trip-details-section');
        coordinates.appendChild(el('strong', 'sarCa-map-dashboard-trip-details-title', 'Pontos confirmados'));
        addTripDetailRow(coordinates, 'Recolha', String(origin) + ' · ' + textValue(trip.pickup_lat, '—') + ', ' + textValue(trip.pickup_lng, '—'));
        addTripDetailRow(coordinates, 'Destino', String(destination) + ' · ' + textValue(trip.dropoff_lat, '—') + ', ' + textValue(trip.dropoff_lng, '—'));
        container.appendChild(coordinates);
      }

      function loadTripDriverDetails(container, trip) {
        var authorizationHeader = lastAuthHeader || loadStoredAuthHeader();
        if (!authorizationHeader || !trip || !trip.id) return;
        var loading = el('div', 'sarCa-map-dashboard-trip-details-loading', 'A carregar os detalhes confirmados do motorista…');
        container.appendChild(loading);
        fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-trip-live-tracking?tripId=' + encodeURIComponent(trip.id), {
          headers: { apikey: SARCA_SUPABASE_KEY, Authorization: authorizationHeader },
        }).then(function (response) {
          return response.ok ? response.json() : null;
        }).then(function (trackingPayload) {
          if (loading.parentNode) loading.parentNode.removeChild(loading);
          renderTripDetails(container, trip, trackingPayload || null);
        }).catch(function () {
          if (loading.parentNode) loading.parentNode.removeChild(loading);
          renderTripDetails(container, trip, null);
          container.appendChild(el('div', 'sarCa-map-dashboard-trip-details-note', 'Os detalhes básicos estão acima. Os dados adicionais do motorista não ficaram disponíveis agora.'));
        });
      }

      trips.forEach(function (trip) {
        var item = el('details', 'sarCa-map-dashboard-trip-item');
        var summary = el('summary', 'sarCa-map-dashboard-trip-summary');
        var summaryCopy = el('span', 'sarCa-map-dashboard-trip-summary-copy');
        var origin = firstValue(trip, ['pickup_address', 'pickup_label', 'origin_label', 'origin_address'], 'Origem confirmada');
        var destination = firstValue(trip, ['dropoff_address', 'destination_label', 'destination_address', 'dropoff_label'], 'Destino confirmado');
        var date = firstValue(trip, ['completed_at', 'ended_at', 'created_at', 'requested_at'], null);
        var fare = minorOrAmount(trip, 'final_fare_minor', 'final_fare');
        summaryCopy.appendChild(el('strong', '', String(origin) + ' → ' + String(destination)));
        summaryCopy.appendChild(el('span', '', 'Concluída com sucesso' + (date ? ' · ' + formatTripDate(date) : '')));
        summary.appendChild(summaryCopy);
        summary.appendChild(el('b', '', fare ? money(fare) : 'Ver detalhes'));
        item.appendChild(summary);
        var detailBody = el('div', 'sarCa-map-dashboard-trip-details');
        renderTripDetails(detailBody, trip, null);
        item.appendChild(detailBody);
        item.addEventListener('toggle', function () {
          if (item.open && item.dataset.driverLoaded !== 'true') {
            item.dataset.driverLoaded = 'true';
            loadTripDriverDetails(detailBody, trip);
          }
        });
        mapDashboardTripsView.appendChild(item);
      });
    }).catch(function (error) {
      mapDashboardTripsView.innerHTML = '';
      mapDashboardTripsView.appendChild(el('div', 'sarCa-map-dashboard-tab-icon', '⚠️'));
      mapDashboardTripsView.appendChild(el('strong', '', 'Não foi possível carregar as viagens'));
      mapDashboardTripsView.appendChild(el('span', '', error && error.message ? error.message : 'Verifica a ligação e tenta novamente.'));
    });
  }

  function profileRequest(path, options) {
    var requestOptions = Object.assign({}, options || {});
    function send(authorization) {
      if (!authorization) return Promise.reject(new Error('Entra na tua conta para continuar.'));
      requestOptions.headers = Object.assign({ apikey: SARCA_SUPABASE_KEY, Authorization: authorization }, requestOptions.headers || {});
      return fetch(SARCA_SUPABASE_URL + path, requestOptions).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok) {
            var error = new Error(payload.error || payload.message || 'Não foi possível concluir esta operação agora.');
            error.status = response.status;
            throw error;
          }
          return payload;
        });
      });
    }
    return getAuthenticatedAuthHeader().then(function (authorization) {
      return send(authorization);
    }).catch(function (error) {
      // A stale web token is common after reopening the WebView. Refresh once
      // and retry only on authentication errors; never duplicate a payment
      // request after a provider response or a network timeout.
      if (!error || error.status !== 401) throw error;
      lastAuthHeader = null;
      return getAuthenticatedAuthHeader().then(send);
    });
  }

  function closeMapDashboardProfileSheet() {
    if (mapDashboardProfileSheet) mapDashboardProfileSheet.remove();
    mapDashboardProfileSheet = null;
  }

  function openMapDashboardProfileSheet(title, subtitle) {
    closeMapDashboardProfileSheet();
    var sheet = el('section', 'sarCa-map-dashboard-profile-sheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', title);
    var header = el('div', 'sarCa-profile-sheet-header');
    var heading = el('div', 'sarCa-profile-sheet-heading');
    heading.appendChild(el('strong', '', title));
    heading.appendChild(el('span', '', subtitle || ''));
    header.appendChild(heading);
    var close = el('button', 'sarCa-profile-sheet-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fechar');
    close.addEventListener('click', closeMapDashboardProfileSheet);
    header.appendChild(close);
    sheet.appendChild(header);
    document.body.appendChild(sheet);
    mapDashboardProfileSheet = sheet;
    return sheet;
  }

  function profileSheetButton(label, handler, className) {
    var button = el('button', className || 'sarCa-profile-sheet-primary', label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function profileSheetMessage(sheet, message, tone) {
    var existing = sheet.querySelector('.sarCa-profile-sheet-message');
    if (existing) existing.remove();
    var safeMessage = String(message || '').replace(/PaySuite/gi, 'processador de pagamentos');
    var messageNode = el('div', 'sarCa-profile-sheet-message ' + (tone || ''), safeMessage);
    sheet.appendChild(messageNode);
    return messageNode;
  }

  function providerCheckoutUrl(result) {
    var data = result && result.data && typeof result.data === 'object' ? result.data : null;
    var payment = result && result.payment && typeof result.payment === 'object' ? result.payment : null;
    var candidates = [result, data, payment];
    for (var index = 0; index < candidates.length; index += 1) {
      var source = candidates[index];
      if (!source) continue;
      var value = source.checkoutUrl || source.checkout_url || source.paymentUrl || source.payment_url || source.redirectUrl || source.redirect_url || source.url;
      if (value && /^https?:\/\//i.test(String(value))) return String(value);
    }
    return null;
  }

  function openMapDashboardWalletAction(mode) {
    var isDeposit = mode === 'deposit';
    var sheet = openMapDashboardProfileSheet(isDeposit ? 'Depositar na carteira' : 'Levantar da carteira', 'O número e a operadora são detetados automaticamente pela tua conta.');
    var amount = document.createElement('input');
    amount.type = 'number';
    amount.min = '1';
    amount.step = '1';
    amount.placeholder = isDeposit ? 'Valor do depósito em MZN' : 'Valor do levantamento em MZN';
    amount.className = 'sarCa-profile-sheet-input';
    sheet.appendChild(amount);
    var feeNote = document.createElement('div');
    feeNote.className = 'sarCa-profile-sheet-note';
    feeNote.textContent = isDeposit
      ? 'A tua carteira recebe o valor indicado. É aplicada uma taxa de processamento de 3% no checkout.'
      : 'Recebes o valor indicado. É aplicada uma taxa de processamento de 3% da tua carteira.';
    sheet.appendChild(feeNote);
    var feePreview = document.createElement('div');
    feePreview.className = 'sarCa-profile-sheet-note';
    function updateWalletFeePreview() {
      var entered = Number(amount.value);
      if (!isFinite(entered) || entered <= 0) {
        feePreview.textContent = '';
        return;
      }
      var fee = Math.round(entered * 0.03 * 100) / 100;
      feePreview.textContent = isDeposit
        ? 'Taxa: ' + fee.toFixed(2) + ' MZN · Total no checkout: ' + (entered + fee).toFixed(2) + ' MZN'
        : 'Taxa: ' + fee.toFixed(2) + ' MZN · Total debitado: ' + (entered + fee).toFixed(2) + ' MZN';
    }
    amount.addEventListener('input', updateWalletFeePreview);
    sheet.appendChild(feePreview);
    var submit = profileSheetButton(isDeposit ? 'Solicitar depósito' : 'Solicitar levantamento', function () {
      var value = Number(amount.value);
      if (!isFinite(value) || value <= 0) {
        profileSheetMessage(sheet, 'Indica um valor válido em MZN.', 'is-error');
        return;
      }
      submit.disabled = true;
      var payload = { amount: value, idempotencyKey: 'rider-web-' + Date.now() };
      if (mapDashboardProfilePhone) payload[isDeposit ? 'sourcePhone' : 'destinationPhone'] = mapDashboardProfilePhone;
      profileRequest('/functions/v1/' + (isDeposit ? 'sarca-create-passenger-wallet-topup' : 'sarca-create-passenger-wallet-payout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (result) {
        var checkoutUrl = providerCheckoutUrl(result);
        if (isDeposit && checkoutUrl) {
          // Navigate in the current app window so WebView/mobile browsers do
          // not leave the user on a blank popup with no checkout.
          window.location.assign(checkoutUrl);
          profileSheetMessage(sheet, 'Checkout de pagamento aberto. Conclui o pagamento para confirmar o depósito.', 'is-success');
        } else {
          profileSheetMessage(sheet, isDeposit
            ? 'O checkout de pagamento não devolveu o link. O depósito não foi confirmado; tenta novamente ou contacta a Central.'
            : 'Pedido de levantamento enviado para processamento.', isDeposit ? 'is-error' : 'is-success');
          if (isDeposit) submit.disabled = false;
        }
        loadMapDashboardProfileData();
        // The wallet changes only after the signed PaySuite webhook. Refresh
        // for a short bounded window so the profile reflects the settled
        // balance without inventing a credit before confirmation.
        scheduleWalletRefresh();
      }).catch(function (error) {
        profileSheetMessage(sheet, error.message || 'Não foi possível enviar o pedido.', 'is-error');
      }).finally(function () { submit.disabled = false; });
    });
    sheet.appendChild(submit);
  }

  function openMapDashboardProfileEditor() {
    var sheet = openMapDashboardProfileSheet('Editar perfil', 'Atualiza o teu nome e a foto do perfil.');
    var name = document.createElement('input');
    name.type = 'text';
    name.className = 'sarCa-profile-sheet-input';
    name.placeholder = 'Nome completo';
    name.value = (document.getElementById('sarCa-profile-name') || {}).textContent || '';
    sheet.appendChild(name);
    var file = document.createElement('input');
    file.type = 'file';
    file.accept = 'image/jpeg,image/png,image/webp';
    file.className = 'sarCa-profile-sheet-file';
    sheet.appendChild(file);
    var save = profileSheetButton('Guardar alterações', function () {
      var authorization = lastAuthHeader || loadStoredAuthHeader();
      if (!authorization) {
        profileSheetMessage(sheet, 'Entra na tua conta para guardar o perfil.', 'is-error');
        return;
      }
      var selectedFile = file.files && file.files[0] ? file.files[0] : null;
      if (selectedFile && ['image/jpeg', 'image/png', 'image/webp'].indexOf(String(selectedFile.type || '').toLowerCase()) === -1) {
        profileSheetMessage(sheet, 'Escolhe uma foto JPG, PNG ou WebP.', 'is-error');
        return;
      }
      if (selectedFile && Number(selectedFile.size || 0) > 10 * 1024 * 1024) {
        profileSheetMessage(sheet, 'A foto deve ter no máximo 10 MB.', 'is-error');
        return;
      }
      save.disabled = true;
      var upload = Promise.resolve(mapDashboardProfileAvatarUrl || '');
      if (selectedFile) {
        var userId = mapDashboardProfileUserId || 'profile-' + Date.now();
        var path = 'users/' + userId + '/' + Date.now() + '-' + String(selectedFile.name || 'avatar').replace(/[^a-zA-Z0-9._-]/g, '-');
        upload = fetch(SARCA_SUPABASE_URL + '/storage/v1/object/profile-media/' + path, {
          method: 'POST',
          headers: { apikey: SARCA_SUPABASE_KEY, Authorization: authorization, 'Content-Type': selectedFile.type, 'x-upsert': 'true' },
          body: selectedFile,
        }).then(function (response) {
          if (!response.ok) throw new Error('Não foi possível carregar a foto.');
          return SARCA_SUPABASE_URL + '/storage/v1/object/public/profile-media/' + path;
        });
      }
      upload.then(function (avatarUrl) {
        return profileRequest('/functions/v1/sarca-update-my-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: String(name.value || '').trim(), avatarUrl: avatarUrl || null }) }).then(function (result) {
          var savedAvatarUrl = result && result.profile && result.profile.avatar_url ? String(result.profile.avatar_url) : String(avatarUrl || '');
          if (selectedFile && !savedAvatarUrl) throw new Error('A foto foi carregada, mas não ficou associada ao perfil. Tenta novamente.');
          var ready = selectedFile && savedAvatarUrl ? verifyProfileAvatarUrl(savedAvatarUrl) : Promise.resolve(savedAvatarUrl);
          return ready.then(function () {
            if (savedAvatarUrl) {
              mapDashboardProfileAvatarUrl = savedAvatarUrl;
              renderMapDashboardProfileAvatar(savedAvatarUrl);
            }
            loadMapDashboardProfileData();
            return result;
          });
        });
      }).then(function () {
        var profileName = document.getElementById('sarCa-profile-name');
        if (profileName && String(name.value || '').trim()) profileName.textContent = String(name.value).trim();
        profileSheetMessage(sheet, 'Perfil atualizado com sucesso.', 'is-success');
      }).catch(function (error) {
        profileSheetMessage(sheet, error.message || 'Não foi possível guardar o perfil.', 'is-error');
      }).finally(function () { save.disabled = false; });
    });
    sheet.appendChild(save);
  }

  function openMapDashboardSupport() {
    var sheet = openMapDashboardProfileSheet('Suporte Central', 'Envia uma mensagem diretamente para a equipa SARCA.');
    var message = document.createElement('textarea');
    message.className = 'sarCa-profile-sheet-input sarCa-profile-sheet-textarea';
    message.placeholder = 'Escreve a tua mensagem';
    sheet.appendChild(message);
    var send = profileSheetButton('Enviar ao Suporte Central', function () {
      var text = String(message.value || '').trim();
      if (!text) {
        profileSheetMessage(sheet, 'Escreve a mensagem antes de enviar.', 'is-error');
        return;
      }
      send.disabled = true;
      profileRequest('/functions/v1/create-sarca-support-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: 'Suporte SARCA', message: text, category: 'general', priority: 'normal', rideId: null, platformCode: 'sarca' }) }).then(function () {
        message.value = '';
        profileSheetMessage(sheet, 'Mensagem enviada ao Suporte Central.', 'is-success');
      }).catch(function (error) {
        profileSheetMessage(sheet, error.message || 'Não foi possível enviar a mensagem.', 'is-error');
      }).finally(function () { send.disabled = false; });
    });
    sheet.appendChild(send);
  }

  function riderNotificationIsMessage(row) {
    if (!row) return false;
    var type = String(row.type || '').toUpperCase();
    var channel = String(row.channel || '').toLowerCase();
    var action = String(row.action || '').toUpperCase();
    return type.indexOf('MESSAGE') !== -1 || type.indexOf('SUPPORT') !== -1 ||
      channel.indexOf('chat') !== -1 || channel.indexOf('support') !== -1 ||
      action.indexOf('MESSAGE') !== -1 || action.indexOf('SUPPORT') !== -1;
  }

  function riderNotificationIsVisible(row) {
    if (!row) return false;
    var type = String(row.type || '').toUpperCase();
    var channel = String(row.channel || '').toLowerCase();
    // Offers are private dispatch work for the Driver app. They must never
    // occupy the Rider notification bell or create a Rider popup.
    if (type === 'SARCA_TRIP_OFFER' || channel === 'courier_dispatch' || channel === 'sarca_driver') return false;
    return true;
  }

  function renderRiderNotificationBadge(rows) {
    if (!riderNotificationButton) return;
    var list = Array.isArray(rows) ? rows : [];
    var unreadMessages = list.filter(function (row) { return riderNotificationIsVisible(row) && row.is_read !== true; }).length;
    riderNotificationButton.textContent = '🔔';
    riderNotificationButton.setAttribute('aria-label', unreadMessages ? 'Notificações, ' + unreadMessages + ' mensagens não lidas' : 'Notificações');
    riderNotificationButton.title = unreadMessages ? unreadMessages + ' mensagem(ns) não lida(s)' : 'Notificações';
    if (unreadMessages > 0) {
      var badge = el('span', 'sarCa-rider-notification-badge', unreadMessages > 99 ? '99+' : String(unreadMessages));
      badge.setAttribute('aria-label', String(unreadMessages) + ' mensagens não lidas');
      riderNotificationButton.appendChild(badge);
      riderNotificationButton.classList.add('has-unread');
    } else {
      riderNotificationButton.classList.remove('has-unread');
    }
  }

  function notifyRiderInBrowser(row) {
    if (!riderNotificationIsVisible(row) || !row.id || !row.title || !row.body || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      var notification = new Notification(String(row.title), { body: String(row.body), tag: 'sarCa-' + String(row.id), renotify: true, silent: false, vibrate: [0, 180, 120, 260] });
      notification.onclick = function () { window.focus(); notification.close(); openMapDashboardNotifications(); };
    } catch (_) {}
  }

  function riderUnreadTripMessages(tripId) {
    var id = String(tripId || '');
    if (!id) return 0;
    return riderNotificationRows.filter(function (row) {
      return row && row.is_read !== true && riderNotificationIsMessage(row) && String(row.entity_id || '') === id;
    }).length;
  }

  function signalRiderIncomingMessage(row) {
    if (!riderNotificationIsMessage(row)) return;
    playVoiceEffect();
    if (lastTripPayload && lastTripPayload.trip) renderTripExtras(lastTripPayload);
  }

  function riderNotificationIsTripUpdate(row) {
    if (!row) return false;
    var type = String(row.type || '').toUpperCase();
    return [
      'SARCA_DRIVER_ASSIGNED',
      'SARCA_PRICE_OFFER_ACCEPTED',
      'SARCA_DRIVER_ARRIVED',
      'SARCA_TRIP_STARTED',
      'SARCA_TRIP_COMPLETED',
      'SARCA_TRIP_CANCELLED',
    ].indexOf(type) !== -1;
  }

  function refreshRiderTripFromNotification(row) {
    if (!riderNotificationIsTripUpdate(row) || !row.entity_id) return;
    if (String(row.type || '').toUpperCase() === 'SARCA_TRIP_COMPLETED') {
      queueTripAnnouncement(
        String(row.entity_id) + ':completed',
        'Chegámos ao destino. Obrigado por viajar com a SARCA!',
      );
    }
    // Push rows are persisted before the notification is delivered. Refresh
    // the authoritative trip immediately instead of waiting for the 10 s
    // tracking fallback, so acceptance/arrival is visible in the same turn.
    refreshTripTracking(String(row.entity_id));
  }

  function formatRiderNotificationDate(value) {
    if (!value) return '';
    try {
      return new Intl.DateTimeFormat('pt-MZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
    } catch (_) { return String(value); }
  }

  function refreshRiderNotifications(listNode) {
    return profileRequest('/rest/v1/push_notifications?select=id,title,body,is_read,created_at,type,channel,action,entity_id&order=created_at.desc&limit=50', { headers: { Accept: 'application/json' } }).then(function (rows) {
      riderNotificationRows = (Array.isArray(rows) ? rows : []).filter(riderNotificationIsVisible);
      renderRiderNotificationBadge(riderNotificationRows);
      riderNotificationRows.forEach(function (row) {
        if (row && row.id) {
          if (riderNotificationInitialized && !riderNotificationKnownIds[row.id] && row.is_read !== true) {
            signalRiderIncomingMessage(row);
            notifyRiderInBrowser(row);
            refreshRiderTripFromNotification(row);
          }
          riderNotificationKnownIds[row.id] = true;
        }
      });
      riderNotificationInitialized = true;
      if (listNode) {
        listNode.textContent = '';
        if (riderNotificationRows.length === 0) listNode.textContent = 'Não existem notificações novas.';
        riderNotificationRows.forEach(function (row) {
          var item = el('div', 'sarCa-profile-sheet-notification' + (row.is_read === true ? '' : ' is-unread'));
          var heading = el('strong', '', row.title || 'SARCA');
          if (row.is_read !== true) heading.appendChild(el('span', 'sarCa-profile-sheet-unread-label', 'Nova'));
          item.appendChild(heading);
          item.appendChild(el('span', '', row.body || 'Atualização da tua conta.'));
          if (row.created_at) item.appendChild(el('small', 'sarCa-profile-sheet-notification-time', formatRiderNotificationDate(row.created_at)));
          listNode.appendChild(item);
        });
      }
      return riderNotificationRows;
    });
  }

  function startRiderNotifications() {
    if (riderNotificationPollTimer) return;
    refreshRiderNotifications().catch(function () {});
    riderNotificationPollTimer = window.setInterval(function () { refreshRiderNotifications().catch(function () {}); }, 2500);
  }

  function stopRiderNotifications() {
    if (riderNotificationPollTimer) window.clearInterval(riderNotificationPollTimer);
    riderNotificationPollTimer = null;
    riderNotificationRows = [];
    riderNotificationKnownIds = Object.create(null);
    riderNotificationInitialized = false;
  }

  function refreshRiderAfterTripCompletion(tripId) {
    var id = String(tripId || '').trim();
    var accessToken = readAccessToken();
    if (!id || !accessToken) return Promise.resolve();
    if (riderCompletionRefreshInFlight[id]) return riderCompletionRefreshInFlight[id];
    var headers = { Authorization: 'Bearer ' + accessToken, apikey: SARCA_SUPABASE_KEY };
    var refresh = Promise.all([
      fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-list-my-trips?limit=50', { headers: headers }).catch(function () { return null; }),
      refreshRiderNotifications().catch(function () { return []; }),
      Promise.resolve(refreshRiderPoints()).catch(function () {}),
      Promise.resolve(refreshRiderRewards()).catch(function () {}),
    ]).then(function () {
      // Rebuild the visible tab immediately so a completed trip cannot leave
      // an old active card, wallet balance or trip count on screen.
      if (riderActiveTab === 'trips' && mapDashboardTripsView) loadMapDashboardTripsView();
      if (riderActiveTab === 'profile' && mapDashboardProfileView) loadMapDashboardProfileData();
      if (lastTripPayload && lastTripPayload.trip && String(lastTripPayload.trip.id || '') === id) {
        renderTripState(lastTripPayload);
      }
    }).finally(function () {
      delete riderCompletionRefreshInFlight[id];
    });
    riderCompletionRefreshInFlight[id] = refresh;
    return refresh;
  }

  function scheduleRiderCompletionRefresh(tripId) {
    var id = String(tripId || '').trim();
    if (!id) return;
    refreshRiderAfterTripCompletion(id).catch(function () {});
    // Payment settlement and the final rating row can commit just after the
    // trip status. One short retry keeps both apps in the same final state.
    if (!riderCompletionRefreshRetryTimers[id]) {
      riderCompletionRefreshRetryTimers[id] = window.setTimeout(function () {
        delete riderCompletionRefreshRetryTimers[id];
        refreshRiderAfterTripCompletion(id).catch(function () {});
      }, 1200);
    }
  }

  function openMapDashboardNotifications() {
    var sheet = openMapDashboardProfileSheet('Notificações', 'Mensagens de suporte, chat e atualizações da tua viagem.');
    var list = el('div', 'sarCa-profile-sheet-list', 'A carregar notificações…');
    sheet.appendChild(list);
    refreshRiderNotifications(list).catch(function (error) { list.textContent = error.message || 'Não foi possível carregar as notificações.'; });
    sheet.appendChild(profileSheetButton('Marcar todas como lidas', function () {
      profileRequest('/rest/v1/push_notifications?is_read=eq.false', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ is_read: true }) }).then(function () {
        riderNotificationRows = riderNotificationRows.map(function (row) { return Object.assign({}, row, { is_read: true }); });
        renderRiderNotificationBadge(riderNotificationRows);
        Array.prototype.forEach.call(list.querySelectorAll('.is-unread'), function (node) { node.classList.remove('is-unread'); });
        profileSheetMessage(sheet, 'Todas as notificações foram marcadas como lidas.', 'is-success');
      }).catch(function (error) { profileSheetMessage(sheet, error.message || 'Não foi possível atualizar as notificações.', 'is-error'); });
    }));
  }

  function openMapDashboardTerms() {
    var sheet = openMapDashboardProfileSheet('Termos e condições', 'SARCA · DeliGo Triunfal, Lda.');
    sheet.appendChild(el('p', 'sarCa-profile-sheet-terms', 'Usa o SARCA com respeito, confirma os dados da viagem antes de embarcar e mantém os teus dados de conta atualizados. A localização é usada para calcular rotas, encontrar profissionais e proteger a operação. Consulta a versão completa dos termos no fluxo de cadastro ou na Central.'));
  }

  function openMapDashboardDeleteAccount() {
    var sheet = openMapDashboardProfileSheet('Eliminar conta', 'Esta ação pede à Central o encerramento da tua conta.');
    sheet.appendChild(el('p', 'sarCa-profile-sheet-terms', 'Antes de continuar, confirma que não tens viagens, pedidos financeiros ou reclamações pendentes. A eliminação é processada pela Central e pode exigir verificação.'));
    sheet.appendChild(profileSheetButton('Confirmar pedido de eliminação', function () {
      profileRequest('/functions/v1/request-account-deletion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'user_requested' }) }).then(function () {
        profileSheetMessage(sheet, 'Pedido de eliminação enviado à Central.', 'is-success');
      }).catch(function (error) { profileSheetMessage(sheet, error.message || 'Não foi possível enviar o pedido.', 'is-error'); });
    }, 'sarCa-profile-sheet-danger'));
  }

  function signOutFromMapDashboard() {
    var authorization = lastAuthHeader || loadStoredAuthHeader();
    var complete = function () {
      stopRiderNotifications();
      lastAuthHeader = null;
      try {
        // Flutter SharedPreferences keeps the rider session under this key.
        // Removing only the Supabase token made logout look successful, then
        // the original app restored the old rider immediately on the next
        // frame. Clear both auth storage and the app session explicitly.
        var clearSessionKey = function (key) {
          return /auth-token|supabase|rider-mobile-session|sarCa-demo-auth|sarCa-auth-session/i.test(key);
        };
        Object.keys(localStorage).filter(clearSessionKey).forEach(function (key) { localStorage.removeItem(key); });
        Object.keys(sessionStorage).filter(clearSessionKey).forEach(function (key) { sessionStorage.removeItem(key); });
      } catch (_) {}
      // Let the original Flutter auth screen render after logout. The map shell
      // is useful for an authenticated rider, but it must not become a guest
      // landing page after the user explicitly chose "Sair".
      window.location.replace(window.location.pathname + '?sarCa-original=1&build=20261105-login-after-signout');
    };
    if (!authorization) { complete(); return; }
    var redirected = false;
    var redirectOnce = function () {
      if (redirected) return;
      redirected = true;
      complete();
    };
    try {
      fetch(SARCA_SUPABASE_URL + '/auth/v1/logout', { method: 'POST', headers: { apikey: SARCA_SUPABASE_KEY, Authorization: authorization } }).then(redirectOnce).catch(redirectOnce);
      // Do not leave the user waiting for a slow logout request; local session
      // removal plus the auth screen is the safe fallback.
      window.setTimeout(redirectOnce, 900);
    } catch (_) { redirectOnce(); }
  }

  function watchForMapShellAfterLogin() {
    if (authReturnTimer) return;
    var check = function () {
      var authorization = lastAuthHeader || loadStoredAuthHeader();
      if (!authorization) return;
      fetch(SARCA_SUPABASE_URL + '/auth/v1/user', {
        headers: { apikey: SARCA_SUPABASE_KEY, Authorization: authorization }
      }).then(function (response) {
        if (!response.ok) return;
        if (authReturnTimer) window.clearInterval(authReturnTimer);
        authReturnTimer = null;
        window.location.replace(window.location.pathname + '?build=20261105-rider-map-home-27');
      }).catch(function () {});
    };
    check();
    authReturnTimer = window.setInterval(check, 800);
    // Some Android WebViews can load the Flutter engine without painting the
    // legacy auth widget (the Rider source entrypoint is not present in this
    // checkout). Keep the user out of an endless loader with a real, small
    // phone/password fallback that uses the same Supabase session contract.
    window.setTimeout(renderPassengerAuthFallback, 1400);
  }

  function renderPassengerAuthFallback() {
    if (!document.body || document.getElementById('sarCa-auth-fallback')) return;
    var existingLoader = document.getElementById('sarca-loader');
    if (existingLoader) existingLoader.remove();

    var style = document.createElement('style');
    style.id = 'sarCa-auth-fallback-style';
    style.textContent = [
      '#sarCa-auth-fallback{position:fixed;inset:0;z-index:2147483646;display:block;overflow-y:auto;box-sizing:border-box;padding:24px 16px;background:linear-gradient(160deg,#06111d,#0b2439);font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#f4f7fb}',
      '#sarCa-auth-fallback .card{width:min(100%,430px);box-sizing:border-box;margin:0 auto;padding:28px 22px;border:1px solid rgba(45,125,255,.5);border-radius:24px;background:rgba(7,21,34,.98);box-shadow:0 24px 70px rgba(0,0,0,.42)}',
      '#sarCa-auth-fallback .eyebrow{margin:0 0 12px;color:#2d9fe8;letter-spacing:3px;font-size:12px;font-weight:900}',
      '#sarCa-auth-fallback h1{margin:0;font-size:34px;line-height:1.02} #sarCa-auth-fallback h1 span{color:#19c37d}',
      '#sarCa-auth-fallback .hint{margin:12px 0 20px;color:rgba(244,247,251,.7);line-height:1.45}',
      '#sarCa-auth-fallback label{display:block;margin:12px 0 6px;color:#d6e4ff;font-size:12px;font-weight:800}',
      '#sarCa-auth-fallback input{width:100%;box-sizing:border-box;padding:13px 14px;border:1px solid rgba(255,255,255,.18);border-radius:12px;outline:none;background:#102b46;color:#fff;font:500 16px system-ui}',
      '#sarCa-auth-fallback input:focus{border-color:#2d9fe8;box-shadow:0 0 0 3px rgba(45,159,232,.16)}',
      '#sarCa-auth-fallback .password-wrap{position:relative}',
      '#sarCa-auth-fallback .password-wrap input{padding-right:52px}',
      '#sarCa-auth-fallback .password-toggle{position:absolute;right:6px;top:6px;width:40px;min-height:38px;margin:0;border:0;border-radius:9px;background:transparent;color:#9fc8ff;font:700 19px system-ui;cursor:pointer}',
      '#sarCa-auth-fallback .password-toggle:hover{background:rgba(45,159,232,.14)}',
      '#sarCa-auth-fallback button{width:100%;min-height:48px;margin-top:18px;border:0;border-radius:12px;background:#19c37d;color:#06111d;font:900 14px system-ui;cursor:pointer}',
      '#sarCa-auth-fallback button:disabled{opacity:.65}',
      '#sarCa-auth-fallback .secondary-actions{display:grid;gap:6px;margin-top:8px}',
      '#sarCa-auth-fallback .secondary-button{min-height:38px;margin-top:0;background:transparent;color:#9fc8ff;font-size:13px}',
      '#sarCa-auth-fallback .secondary-button:hover{background:rgba(45,159,232,.12)}',
      '#sarCa-auth-fallback .secondary-button.back{color:rgba(244,247,251,.7)}',
      '#sarCa-auth-fallback .terms{display:flex;align-items:flex-start;gap:9px;margin-top:15px;color:rgba(244,247,251,.74);font-size:12px;line-height:1.35}',
      '#sarCa-auth-fallback .terms input{width:18px;height:18px;flex:none;margin:0;accent-color:#19c37d}',
      '#sarCa-auth-fallback .error{min-height:20px;margin-top:12px;color:#ff9ea6;font-size:13px;line-height:1.35}',
      '#sarCa-auth-fallback .footer{margin-top:18px;color:rgba(244,247,251,.58);font-size:12px;text-align:center}'
    ].join('');
    document.head.appendChild(style);

    var shell = document.createElement('section');
    shell.id = 'sarCa-auth-fallback';
    shell.innerHTML = '<div class="card"></div>';
    document.body.appendChild(shell);
    var card = shell.querySelector('.card');

    function requestFunction(path, body) {
      return window.fetch(SARCA_SUPABASE_URL + path, {
        method: 'POST',
        headers: { apikey: SARCA_SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (payload) {
          if (!response.ok || payload.error) {
            throw new Error(payload.error_description || payload.error || payload.msg || 'Não foi possível concluir o pedido. Tenta novamente.');
          }
          return payload;
        });
      });
    }

    function bindPasswordToggles() {
      Array.prototype.forEach.call(card.querySelectorAll('[data-action="toggle-password"]'), function (toggle) {
        toggle.addEventListener('click', function () {
          var wrap = toggle.parentElement;
          var input = wrap && wrap.querySelector('input');
          if (!input) return;
          var visible = input.type === 'text';
          input.type = visible ? 'password' : 'text';
          toggle.textContent = visible ? '👁' : '🙈';
          toggle.setAttribute('aria-label', visible ? 'Mostrar senha' : 'Ocultar senha');
        });
      });
    }

    function showLogin(phoneValue) {
      card.innerHTML = '<p class="eyebrow">SARCA PASSAGEIRO</p><h1>Entrar no <span>SARCA</span></h1><p class="hint">Usa o número e a palavra-passe da tua conta para continuar.</p><form><label>Número de telemóvel</label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+258841234567" required><label>Palavra-passe</label><div class="password-wrap"><input name="password" type="password" autocomplete="current-password" placeholder="A tua palavra-passe" required><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Mostrar senha">👁</button></div><div class="error" role="alert"></div><button type="submit">Entrar como passageiro</button><div class="secondary-actions"><button type="button" class="secondary-button" data-action="forgot">Esqueceu a palavra-passe?</button><button type="button" class="secondary-button" data-action="register">Criar conta de passageiro</button></div></form><p class="footer">Mobilidade com confiança · SARCA</p>';
      var form = card.querySelector('form');
      var error = card.querySelector('.error');
      var button = form.querySelector('button[type="submit"]');
      if (phoneValue) form.elements.phone.value = phoneValue;
      bindPasswordToggles();
      card.querySelector('[data-action="forgot"]').addEventListener('click', function () { showForgot(form.elements.phone.value); });
      card.querySelector('[data-action="register"]').addEventListener('click', function () { showRegister(form.elements.phone.value); });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var phone = String(form.elements.phone.value || '').trim();
        var password = String(form.elements.password.value || '');
        error.textContent = '';
        button.disabled = true;
        button.textContent = 'A entrar…';
        requestFunction('/functions/v1/sarca-central-login', { phone: phone, password: password }).then(function (payload) {
          var session = payload && payload.session;
          if (!session || !session.access_token) throw new Error('Não foi possível abrir a sessão. Confirma o número e a palavra-passe.');
          window.localStorage.setItem('sarCa-auth-session', JSON.stringify({ currentSession: session }));
          lastAuthHeader = 'Bearer ' + String(session.access_token);
          window.location.replace(window.location.pathname + '?build=20261105-rider-map-home-27');
        }).catch(function (caught) {
          error.textContent = caught && caught.message ? caught.message : 'Não foi possível entrar. Tenta novamente.';
          button.disabled = false;
          button.textContent = 'Entrar como passageiro';
        });
      });
    }

    function showRegister(phoneValue) {
      card.innerHTML = '<p class="eyebrow">SARCA PASSAGEIRO</p><h1>Criar conta <span>SARCA</span></h1><p class="hint">Cria a tua conta com o código recebido por SMS.</p><form><label>Nome completo</label><input name="fullName" type="text" autocomplete="name" placeholder="O teu nome" required><label>Número de telemóvel</label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+258841234567" required><button type="button" class="secondary-button" data-action="send-otp">Receber código por SMS</button><label>Código recebido</label><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required><label>Palavra-passe</label><div class="password-wrap"><input name="password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Mostrar senha">👁</button></div><label class="terms"><input name="terms" type="checkbox"><span>Li e aceito os Termos e condições.</span></label><div class="error" role="alert"></div><button type="submit">Criar conta de passageiro</button><div class="secondary-actions"><button type="button" class="secondary-button back" data-action="login">Já tenho conta · Entrar</button></div></form><p class="footer">Mobilidade com confiança · SARCA</p>';
      var form = card.querySelector('form');
      var error = card.querySelector('.error');
      var otpButton = card.querySelector('[data-action="send-otp"]');
      var submitButton = form.querySelector('button[type="submit"]');
      if (phoneValue) form.elements.phone.value = phoneValue;
      bindPasswordToggles();
      card.querySelector('[data-action="login"]').addEventListener('click', function () { showLogin(form.elements.phone.value); });
      otpButton.addEventListener('click', function () {
        var phone = String(form.elements.phone.value || '').trim();
        error.textContent = '';
        otpButton.disabled = true;
        otpButton.textContent = 'A enviar…';
        requestFunction('/functions/v1/sarca-send-signup-otp', { phone: phone, purpose: 'signup' }).then(function () {
          error.style.color = '#8ff0bd';
          error.textContent = 'Código enviado por SMS.';
        }).catch(function (caught) {
          error.style.color = '#ff9ea6';
          error.textContent = caught.message || 'Não foi possível enviar o código.';
        }).finally(function () {
          otpButton.disabled = false;
          otpButton.textContent = 'Receber código por SMS';
        });
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!form.elements.terms.checked) { error.style.color = '#ff9ea6'; error.textContent = 'Aceita os Termos e condições para continuar.'; return; }
        var body = { phone: String(form.elements.phone.value || '').trim(), code: String(form.elements.code.value || '').trim(), password: String(form.elements.password.value || ''), fullName: String(form.elements.fullName.value || '').trim(), appRole: 'passenger' };
        error.style.color = '#ff9ea6';
        error.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'A criar conta…';
        requestFunction('/functions/v1/sarca-register-phone-password', body).then(function (payload) {
          var session = payload.session;
          if (session && session.access_token) return session;
          return requestFunction('/functions/v1/sarca-central-login', { phone: body.phone, password: body.password }).then(function (loginPayload) { if (!loginPayload || !loginPayload.session || !loginPayload.session.access_token) throw new Error('Conta criada. Já podes entrar com os teus dados.'); return loginPayload.session; });
        }).then(function (session) {
          window.localStorage.setItem('sarCa-auth-session', JSON.stringify({ currentSession: session }));
          lastAuthHeader = 'Bearer ' + String(session.access_token);
          window.location.replace(window.location.pathname + '?build=20261105-rider-map-home-27');
        }).catch(function (caught) {
          error.textContent = caught.message || 'Não foi possível criar a conta. Tenta novamente.';
          submitButton.disabled = false;
          submitButton.textContent = 'Criar conta de passageiro';
        });
      });
    }

    function showForgot(phoneValue) {
      card.innerHTML = '<p class="eyebrow">RECUPERAR ACESSO</p><h1>Esqueceu a <span>senha?</span></h1><p class="hint">Recebe um código por SMS e define uma nova palavra-passe.</p><form><label>Número de telemóvel</label><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+258841234567" required><button type="button" class="secondary-button" data-action="send-otp">Enviar código por SMS</button><label>Código recebido</label><input name="code" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" required><label>Nova palavra-passe</label><div class="password-wrap"><input name="password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" required><button type="button" class="password-toggle" data-action="toggle-password" aria-label="Mostrar senha">👁</button></div><div class="error" role="alert"></div><button type="submit">Alterar palavra-passe</button><div class="secondary-actions"><button type="button" class="secondary-button back" data-action="login">Voltar ao login</button></div></form><p class="footer">O código expira em 10 minutos · SARCA</p>';
      var form = card.querySelector('form');
      var error = card.querySelector('.error');
      var otpButton = card.querySelector('[data-action="send-otp"]');
      var submitButton = form.querySelector('button[type="submit"]');
      if (phoneValue) form.elements.phone.value = phoneValue;
      bindPasswordToggles();
      card.querySelector('[data-action="login"]').addEventListener('click', function () { showLogin(form.elements.phone.value); });
      otpButton.addEventListener('click', function () {
        var phone = String(form.elements.phone.value || '').trim();
        error.textContent = '';
        otpButton.disabled = true;
        otpButton.textContent = 'A enviar…';
        requestFunction('/functions/v1/sarca-send-signup-otp', { phone: phone, purpose: 'password_reset' }).then(function () {
          error.style.color = '#8ff0bd';
          error.textContent = 'Código enviado por SMS.';
        }).catch(function (caught) {
          error.style.color = '#ff9ea6';
          error.textContent = caught.message || 'Não foi possível enviar o código.';
        }).finally(function () {
          otpButton.disabled = false;
          otpButton.textContent = 'Enviar código por SMS';
        });
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var body = { action: 'reset_password', phone: String(form.elements.phone.value || '').trim(), code: String(form.elements.code.value || '').trim(), password: String(form.elements.password.value || '') };
        error.style.color = '#ff9ea6';
        error.textContent = '';
        submitButton.disabled = true;
        submitButton.textContent = 'A atualizar…';
        requestFunction('/functions/v1/sarca-register-phone-password', body).then(function () {
          showLogin(body.phone);
          var loginError = card.querySelector('.error');
          loginError.style.color = '#8ff0bd';
          loginError.textContent = 'Palavra-passe atualizada. Já podes entrar.';
        }).catch(function (caught) {
          error.textContent = caught.message || 'Não foi possível alterar a palavra-passe.';
          submitButton.disabled = false;
          submitButton.textContent = 'Alterar palavra-passe';
        });
      });
    }

    showLogin();
  }

  function renderPickupSuggestions(input, places) {
    clearDestinationSuggestions();
    if (!input || !places.length || !document.body) return;
    var rect = input.getBoundingClientRect();
    var isDashboardInput = input === mapDashboardPickupInput || input === mapDashboardDestinationInput;
    var panel = el('div', 'sarca-destination-suggestions');
    panel.id = 'sarca-destination-suggestions';
    panel.style.position = isDashboardInput ? 'relative' : 'fixed';
    panel.style.left = isDashboardInput ? 'auto' : Math.max(12, rect.left) + 'px';
    panel.style.top = isDashboardInput ? 'auto' : (rect.bottom + 8) + 'px';
    panel.style.width = isDashboardInput ? '100%' : Math.min(rect.width, window.innerWidth - 24) + 'px';
    // Keep the results above the Flutter/map layers on Android WebView too.
    // A relative panel with a low stacking order can be painted behind the
    // map canvas even though the input itself remains editable.
    panel.style.zIndex = isDashboardInput ? '70' : '60';
    panel.style.boxSizing = 'border-box';
    panel.style.padding = '6px';
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(8,20,34,.96)';
    panel.style.boxShadow = '0 10px 28px rgba(0,0,0,.24)';
    panel.style.backdropFilter = 'blur(10px)';
    panel.style.webkitBackdropFilter = 'blur(10px)';
    panel.style.maxHeight = isDashboardInput ? '220px' : '184px';
    panel.style.overflowY = 'auto';
    panel.style.marginTop = isDashboardInput ? '6px' : '0';
    places.slice(0, 6).forEach(function (place) {
      var info = localPlaceLabel(place);
      if (!info.title) return;
      var secondary = localPlaceSecondaryLabel(info);
      var button = el('button', 'sarca-destination-suggestion');
      button.type = 'button';
      button.style.display = 'block';
      button.style.width = '100%';
      button.style.padding = '11px 12px';
      button.style.border = '0';
      button.style.borderBottom = '1px solid rgba(255,255,255,.09)';
      button.style.background = 'transparent';
      button.style.color = '#fff';
      button.style.textAlign = 'left';
      button.style.cursor = 'pointer';
      button.innerHTML = '<strong style="display:block;font:700 13px/1.25 system-ui,sans-serif">' + escapeHtml(info.title) + '</strong>' +
        '<span style="display:block;margin-top:3px;color:rgba(255,255,255,.68);font:500 11px/1.25 system-ui,sans-serif">' +
        escapeHtml(secondary) + '</span>';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        lastCurrentLocation = {
          label: info.reference ? info.title + ' · ' + info.reference : info.title,
          latitude: Number(place.latitude),
          longitude: Number(place.longitude),
          placeId: place.id || null,
        };
        pickupUsesCurrentLocation = false;
        rememberCurrentLocation(lastCurrentLocation);
        fillFlutterPickupField(lastCurrentLocation.label);
        input.value = lastCurrentLocation.label;
        clearDestinationSuggestions();
        startNearbyDriversPolling();
        syncFullMapSurface();
        if (lastDestinationSelection) prepareDestinationRoute(lastDestinationSelection);
        window.dispatchEvent(new CustomEvent('sarCa:pickup-selected', { detail: lastCurrentLocation }));
      });
      panel.appendChild(button);
    });
    if (!panel.children.length) return;
    if (isDashboardInput && mapDashboardPanel) {
      var home = mapDashboardPanel.querySelector('.sarCa-map-dashboard-home');
      if (home) {
        mapDashboardPanel.classList.add('has-suggestions');
        home.appendChild(panel);
      }
      else document.body.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }
  }

  function searchPickupPlaces(input) {
    var query = String(input && input.value || '').trim();
    // Start searching from the first character. The local catalogue and
    // Mapbox both support partial input; waiting for two characters made the
    // passenger leave the field before seeing useful places.
    if (query.length < 1) {
      clearDestinationSuggestions();
      return;
    }
    var requestId = ++destinationSearchRequestId;
    fetch(SARCA_SUPABASE_URL + '/rest/v1/rpc/search_map_places', {
      method: 'POST',
      headers: {
        apikey: SARCA_SUPABASE_KEY,
        Authorization: 'Bearer ' + SARCA_SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Accept-Profile': 'sarca',
        'Content-Profile': 'sarca',
      },
      body: JSON.stringify({
        p_query: query,
        p_latitude: lastCurrentLocation ? lastCurrentLocation.latitude : null,
        p_longitude: lastCurrentLocation ? lastCurrentLocation.longitude : null,
        p_limit: 6,
      }),
    }).then(function (response) {
      return response.ok ? response.json() : [];
    }).then(function (places) {
      if (requestId !== destinationSearchRequestId || mapDashboardPickupInput !== input) return;
      renderPickupSuggestions(input, Array.isArray(places) ? places : []);
    }).catch(function () {
      if (requestId === destinationSearchRequestId) clearDestinationSuggestions();
    });
  }

  function installMapDashboardShell() {
    if (mapDashboardShell) return;
    mapDashboardShell = el('div', '', '');
    mapDashboardShell.id = 'sarCa-map-dashboard-shell';

    var topbar = el('div', '', '');
    topbar.id = 'sarCa-map-dashboard-topbar';
    topbar.classList.add('sarCa-map-dashboard-topbar--minimal');
    topbar.appendChild(el('strong', 'sarCa-map-dashboard-brand', 'SARCA'));
    var topActions = el('div', 'sarCa-map-dashboard-actions');
    riderNotificationButton = el('button', 'sarCa-map-dashboard-notifications', '🔔');
    var notificationButton = riderNotificationButton;
    notificationButton.type = 'button';
    notificationButton.title = 'Notificações';
    notificationButton.addEventListener('click', function () {
      window.dispatchEvent(new CustomEvent('sarCa:open-notifications'));
      openMapDashboardNotifications();
    });
    notificationButton.addEventListener('click', function () {
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(function () {});
    });
    renderRiderNotificationBadge([]);
    topActions.appendChild(notificationButton);
    topbar.appendChild(topActions);
    mapDashboardShell.appendChild(topbar);

    mapDashboardPanel = el('section', '', '');
    mapDashboardPanel.id = 'sarCa-map-dashboard-panel';
    mapDashboardPanel.appendChild(el('div', 'sarCa-map-dashboard-grabber'));
    mapDashboardPanel.appendChild(el('h2', '', 'Olá! Para onde vais?'));
    mapDashboardPanel.appendChild(el('p', '', 'Escolhe a localização e o destino sem sair do mapa.'));
    var serviceChoice = el('div', 'sarCa-map-dashboard-service-choice');
    [['trip', '🚗', 'Viagem'], ['delivery', '📦', 'Entrega']].forEach(function (entry) {
      var serviceButton = el('button', entry[0] === mapDashboardService ? 'is-active' : '', entry[1] + ' ' + entry[2]);
      serviceButton.type = 'button';
      serviceButton.dataset.sarcaService = entry[0];
      serviceButton.setAttribute('aria-pressed', entry[0] === mapDashboardService ? 'true' : 'false');
      serviceButton.addEventListener('click', function () { setMapDashboardService(entry[0]); });
      serviceChoice.appendChild(serviceButton);
    });
    mapDashboardPanel.appendChild(serviceChoice);

    var home = el('div', 'sarCa-map-dashboard-home');
    home.appendChild(el('div', 'sarCa-map-dashboard-section-label', 'De onde vais sair?'));
    var locationRow = el('div', 'sarCa-map-dashboard-location');
    locationRow.appendChild(el('span', 'sarCa-map-dashboard-location-icon', '📍'));
    mapDashboardPickupInput = document.createElement('input');
    mapDashboardPickupInput.id = 'sarCa-map-dashboard-location-label';
    mapDashboardPickupInput.className = 'sarCa-map-dashboard-pickup';
    mapDashboardPickupInput.type = 'search';
    mapDashboardPickupInput.placeholder = 'Localização atual';
    mapDashboardPickupInput.autocomplete = 'off';
    mapDashboardPickupInput.value = (lastCurrentLocation && lastCurrentLocation.label) || 'Localização atual';
    mapDashboardPickupInput.setAttribute('aria-label', 'Localização atual ou origem');
    mapDashboardPickupInput.addEventListener('input', function () { searchPickupPlaces(mapDashboardPickupInput); });
    mapDashboardPickupInput.addEventListener('focus', function () {
      if (mapDashboardPickupInput.value && mapDashboardPickupInput.value !== 'Localização atual') searchPickupPlaces(mapDashboardPickupInput);
    });
    mapDashboardPickupInput.addEventListener('blur', function () { setTimeout(clearDestinationSuggestions, 180); });
    locationRow.appendChild(mapDashboardPickupInput);
    var locationButton = el('button', 'sarCa-map-dashboard-location-button', '⌖');
    locationButton.type = 'button';
    locationButton.title = 'Usar localização atual';
    locationButton.setAttribute('aria-label', 'Usar localização atual');
    locationButton.addEventListener('click', requestCurrentLocationForPickup);
    mapDashboardLocationButton = locationButton;
    locationRow.appendChild(locationButton);
    home.appendChild(locationRow);
    home.appendChild(el('div', 'sarCa-map-dashboard-location-hint', 'Escreve uma rua, bairro ou usa a tua posição.'));
    mapDashboardDestinationInput = document.createElement('input');
    mapDashboardDestinationInput.id = 'sarCa-map-dashboard-destination';
    mapDashboardDestinationInput.className = 'sarCa-map-dashboard-destination';
    mapDashboardDestinationInput.type = 'search';
    mapDashboardDestinationInput.placeholder = 'Para onde vais?';
    mapDashboardDestinationInput.autocomplete = 'off';
    mapDashboardDestinationInput.setAttribute('aria-label', 'Para onde?');
    mapDashboardDestinationInput.addEventListener('input', function () {
      if (mapDashboardDestinationInput.__sarCaSelectedValue && mapDashboardDestinationInput.value === mapDashboardDestinationInput.__sarCaSelectedValue) {
        clearDestinationSuggestions();
        return;
      }
      mapDashboardDestinationInput.__sarCaSelectedValue = '';
      resetDestinationSelectionForEditing();
      searchDestinationPlaces(mapDashboardDestinationInput);
    });
    home.appendChild(mapDashboardDestinationInput);
    mapDashboardDeliveryDetails = el('div', 'sarCa-map-dashboard-delivery-details');
    mapDashboardDeliveryDetails.hidden = true;
    mapDashboardDeliveryDetails.appendChild(el('div', 'sarCa-map-dashboard-delivery-title', 'Detalhes da entrega'));
    mapDashboardDeliveryDetails.appendChild(el('div', 'sarCa-map-dashboard-delivery-hint', 'Recolha e entrega ficam no mesmo mapa. Usa referências para facilitar o encontro.'));
    function deliveryTextInput(placeholder, type) {
      var input = document.createElement('input');
      input.type = type || 'text';
      input.className = 'sarCa-map-dashboard-delivery-input';
      input.placeholder = placeholder;
      input.autocomplete = 'off';
      return input;
    }
    mapDashboardPickupReferenceInput = deliveryTextInput('Referência da recolha (ex.: portão azul)');
    mapDashboardDeliveryReferenceInput = deliveryTextInput('Referência da entrega (ex.: atrás da farmácia)');
    mapDashboardPackageDescriptionInput = deliveryTextInput('O que vais enviar? (descrição curta)');
    mapDashboardPackageSizeSelect = document.createElement('select');
    mapDashboardPackageSizeSelect.className = 'sarCa-map-dashboard-delivery-input';
    [['', 'Tamanho do volume'], ['Envelope', 'Envelope'], ['Saco pequeno', 'Saco pequeno'], ['Caixa que cabe na bagageira', 'Caixa que cabe na bagageira']].forEach(function (optionData) {
      var option = document.createElement('option');
      option.value = optionData[0];
      option.textContent = optionData[1];
      mapDashboardPackageSizeSelect.appendChild(option);
    });
    mapDashboardRecipientNameInput = deliveryTextInput('Nome de quem recebe');
    mapDashboardRecipientPhoneInput = deliveryTextInput('Número de quem recebe', 'tel');
    [mapDashboardPickupReferenceInput, mapDashboardDeliveryReferenceInput, mapDashboardPackageDescriptionInput, mapDashboardPackageSizeSelect, mapDashboardRecipientNameInput, mapDashboardRecipientPhoneInput].forEach(function (input) {
      mapDashboardDeliveryDetails.appendChild(input);
    });
    home.appendChild(mapDashboardDeliveryDetails);

    mapDashboardCategoryChoice = el('div', 'sarCa-map-dashboard-category-choice');
    mapDashboardCategoryChoice.hidden = true;
    mapDashboardCategoryChoice.appendChild(el('div', 'sarCa-map-dashboard-category-title', 'Compara os preços'));
    mapDashboardCategoryChoice.appendChild(el('div', 'sarCa-map-dashboard-category-hint', 'Primeiro confirma a origem e escolhe um destino.'));
    var categoryGrid = el('div', 'sarCa-map-dashboard-category-grid');
    var categoryDefinitions = MAP_DASHBOARD_CATEGORIES;
    categoryDefinitions.forEach(function (entry) {
      var categoryButton = el('button', 'sarCa-map-dashboard-category-card');
      categoryButton.type = 'button';
      categoryButton.dataset.sarcaCategory = entry.id;
      categoryButton.setAttribute('aria-pressed', 'false');
      categoryButton.appendChild(el('span', 'sarCa-map-dashboard-category-name', entry.icon + ' ' + entry.label));
      var categoryPrice = el('strong', 'sarCa-map-dashboard-category-price', 'A consultar');
      categoryPrice.dataset.sarcaCategoryPrice = entry.id;
      categoryButton.appendChild(categoryPrice);
      var categoryAvailability = el('span', 'sarCa-map-dashboard-category-availability', 'Confirma origem e destino');
      categoryAvailability.dataset.sarcaCategoryAvailability = entry.id;
      categoryButton.appendChild(categoryAvailability);
      categoryButton.addEventListener('click', function () { setMapDashboardCategory(entry.id); });
      categoryGrid.appendChild(categoryButton);
    });
    mapDashboardCategoryChoice.appendChild(categoryGrid);
    home.appendChild(mapDashboardCategoryChoice);
    mapDashboardPanel.appendChild(home);
    mapDashboardRouteAction = el('button', 'sarCa-map-dashboard-route-action', 'PREPARAR PEDIDO');
    mapDashboardRouteAction.type = 'button';
    mapDashboardRouteAction.hidden = true;
    mapDashboardRouteAction.addEventListener('click', prepareMapDashboardPreview);
    mapDashboardPanel.appendChild(mapDashboardRouteAction);

    mapDashboardTripsView = el('div', 'sarCa-map-dashboard-tab-view sarCa-map-dashboard-trips-view');
    mapDashboardTripsView.hidden = true;
    mapDashboardTripsView.appendChild(el('div', 'sarCa-map-dashboard-tab-icon', '🚗'));
    mapDashboardTripsView.appendChild(el('strong', '', 'Ainda não há viagens concluídas com sucesso'));
    mapDashboardTripsView.appendChild(el('span', '', 'Viagens canceladas ou incompletas não aparecem aqui. Quando terminares uma viagem, abre-a para veres o recibo e todos os detalhes.'));
    mapDashboardPanel.appendChild(mapDashboardTripsView);

    mapDashboardProfileView = el('div', 'sarCa-map-dashboard-tab-view sarCa-map-dashboard-profile-view');
    mapDashboardProfileView.hidden = true;
    var identity = el('div', 'sarCa-map-dashboard-profile-identity');
    var profileAvatar = el('div', 'sarCa-map-dashboard-profile-avatar', '👤');
    profileAvatar.id = 'sarCa-profile-avatar';
    identity.appendChild(profileAvatar);
    var identityCopy = el('div', 'sarCa-map-dashboard-profile-identity-copy');
    identityCopy.appendChild(el('strong', '', 'Conta SARCA'));
    identityCopy.appendChild(el('span', '', 'Número ainda não disponível'));
    identityCopy.querySelector('strong').id = 'sarCa-profile-name';
    identityCopy.querySelector('span').id = 'sarCa-profile-phone';
    identity.appendChild(identityCopy);
    mapDashboardProfileView.appendChild(identity);

    var profileStats = el('div', 'sarCa-map-dashboard-profile-stats');
    [['Função', 'Passageiro', 'sarCa-profile-role'], ['Carteiras', '--', 'sarCa-profile-wallet-count'], ['Viagens', '--', 'sarCa-profile-trip-count'], ['Avaliações', '0', 'sarCa-profile-rating-count']].forEach(function (stat) {
      var statCard = el('div', 'sarCa-map-dashboard-profile-stat');
      statCard.appendChild(el('span', '', stat[0]));
      var value = el('strong', '', stat[1]);
      value.id = stat[2];
      statCard.appendChild(value);
      profileStats.appendChild(statCard);
    });
    mapDashboardProfileView.appendChild(profileStats);

    var walletCard = el('div', 'sarCa-map-dashboard-profile-card');
    walletCard.appendChild(el('strong', '', '💳 Carteira do passageiro'));
    walletCard.appendChild(el('span', '', 'Saldo disponível'));
    var walletBalance = el('strong', 'sarCa-map-dashboard-wallet-balance', '-- MZN');
    walletBalance.id = 'sarCa-profile-wallet-balance';
    walletCard.appendChild(walletBalance);
    var walletActions = el('div', 'sarCa-map-dashboard-profile-actions');
    [['Depositar', 'deposit'], ['Levantar', 'withdraw']].forEach(function (entry) {
      var actionButton = el('button', '', entry[0]);
      actionButton.type = 'button';
      actionButton.dataset.sarcaProfileAction = entry[1];
      actionButton.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent('sarCa:open-wallet', { detail: { mode: entry[1] } }));
        openMapDashboardWalletAction(entry[1]);
      });
      walletActions.appendChild(actionButton);
    });
    walletCard.appendChild(walletActions);
    mapDashboardProfileView.appendChild(walletCard);

    var accountCard = el('div', 'sarCa-map-dashboard-profile-card');
    accountCard.appendChild(el('strong', '', '⚙️ Conta e apoio'));
    var accountActions = el('div', 'sarCa-map-dashboard-profile-menu');
    [['✏️', 'Editar perfil', 'sarCa:edit-profile', 'edit'], ['🔔', 'Notificações', 'sarCa:open-notifications', 'notifications'], ['💬', 'Suporte Central', 'sarCa:open-support', 'support'], ['📄', 'Termos e condições', 'sarCa:open-terms', 'terms'], ['🗑️', 'Eliminar conta', 'sarCa:request-account-deletion', 'delete'], ['🚪', 'Sair', 'sarCa:sign-out', 'signout']].forEach(function (entry) {
      var action = el('button', '', entry[0] + '  ' + entry[1]);
      action.type = 'button';
      action.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent(entry[2]));
        if (entry[3] === 'edit') openMapDashboardProfileEditor();
        else if (entry[3] === 'notifications') openMapDashboardNotifications();
        else if (entry[3] === 'support') openMapDashboardSupport();
        else if (entry[3] === 'terms') openMapDashboardTerms();
        else if (entry[3] === 'delete') openMapDashboardDeleteAccount();
        else if (entry[3] === 'signout') signOutFromMapDashboard();
      });
      accountActions.appendChild(action);
    });
    accountCard.appendChild(accountActions);
    mapDashboardProfileView.appendChild(accountCard);

    var savedCard = el('div', 'sarCa-map-dashboard-profile-card');
    savedCard.appendChild(el('strong', '', '📍 Locais guardados'));
    savedCard.appendChild(el('span', '', 'Casa e Trabalho aparecem aqui apenas quando os guardares.'));
    savedCard.appendChild(el('span', 'sarCa-map-dashboard-profile-muted', 'Ainda não tens locais guardados.'));
    mapDashboardProfileView.appendChild(savedCard);
    mapDashboardPanel.appendChild(mapDashboardProfileView);
    loadMapDashboardProfileData();
    mapDashboardShell.appendChild(mapDashboardPanel);

    var nav = el('nav', '', '');
    nav.id = 'sarCa-map-dashboard-nav';
    [['home', '⌂', 'Início'], ['trips', '▣', 'Viagens'], ['profile', '♙', 'Perfil']].forEach(function (entry, index) {
      var button = el('button', index === 0 ? 'is-active' : '', '');
      button.type = 'button';
      button.dataset.tab = entry[0];
      button.appendChild(el('span', '', entry[1]));
      button.appendChild(document.createTextNode(entry[2]));
      button.addEventListener('click', function () { setMapDashboardTab(entry[0]); });
      nav.appendChild(button);
    });
    mapDashboardShell.appendChild(nav);
    document.body.appendChild(mapDashboardShell);
    document.body.classList.add('sarCa-map-tab-home');
    document.body.classList.remove('sarCa-map-tab-not-home');
    startRiderNotifications();
    updateMapDashboardLocationLabel((lastCurrentLocation && lastCurrentLocation.label) || 'Localização atual');
  }

  function setMapDashboardTab(tab) {
    if (!mapDashboardShell) return;
    riderActiveTab = tab;
    var isHome = tab === 'home';
    document.body.classList.toggle('sarCa-map-tab-home', isHome);
    document.body.classList.toggle('sarCa-map-tab-not-home', !isHome);
    mapDashboardShell.querySelectorAll('#sarCa-map-dashboard-nav button').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.tab === tab);
    });
    renderMapDashboardTab(tab);
    if (isHome) {
      if (lastTripPayload && lastTripPayload.trip) renderTripState(lastTripPayload);
      else restoreActivePassengerTrip();
    }
    window.dispatchEvent(new CustomEvent('sarCa:navigation-tab', { detail: { tab: tab } }));
  }

  function installCompactUi() {
    if (document.getElementById('sarCa-compact-ui')) return;
    var style = document.createElement('style');
    style.id = 'sarCa-compact-ui';
    style.textContent = `
      #sarca-weather-card {
        position: fixed;
        top: max(12px, env(safe-area-inset-top));
        left: 50%;
        right: auto;
        width: min(270px, calc(100vw - 150px));
        transform: translateX(-50%);
        z-index: 31;
        box-sizing: border-box;
        padding: 2px 6px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #fff;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        font: 500 11px/1.15 system-ui, sans-serif;
        pointer-events: none;
      }
      #sarca-weather-card button { pointer-events: auto; }
      #sarca-weather-card .sarca-weather__top { display:flex; justify-content:center; align-items:center; gap:5px; }
      #sarca-weather-card .sarca-weather__eyebrow { font-size:9px; opacity:.96; color:#2d7dff; font-weight:800; }
      #sarca-weather-card .sarca-weather__updated { font-size:9px; opacity:.9; color:#c8dcff; white-space:nowrap; }
      #sarca-weather-card .sarca-weather__row { display:flex; align-items:center; justify-content:center; gap:5px; min-height:22px; }
      #sarca-weather-card .sarca-weather__icon { font-size:15px; line-height:1; }
      #sarca-weather-card .sarca-weather__temp { font-size:16px; line-height:1; font-weight:800; }
      #sarca-weather-card .sarca-weather__condition { display:flex; align-items:baseline; gap:7px; min-width:0; }
      #sarca-weather-card .sarca-weather__condition strong { font-size:10px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #sarca-weather-card .sarca-weather__condition span { font-size:9px; opacity:.92; color:#c8dcff; white-space:nowrap; }
      #sarca-weather-card .sarca-weather__rain-copy,
      #sarca-weather-card .sarca-weather__location-copy { margin-top:3px; font-size:10px; opacity:.78; }
      #sarca-weather-card .sarca-weather__location-button { margin-top:4px; padding:4px 8px; border:0; border-radius:8px; background:rgba(255,255,255,.16); color:inherit; font-size:10px; }
      #sarca-location-shortcut {
        position: fixed;
        top: clamp(128px, 20vh, 188px);
        left: 18px;
        right: 18px;
        z-index: 22;
        display: flex;
        justify-content: center;
        pointer-events: none;
      }
      #sarca-location-shortcut button {
        pointer-events: auto;
        min-height: 34px;
        padding: 7px 14px;
        border: 1px solid rgba(255,255,255,.32);
        border-radius: 999px;
        background: rgba(7, 25, 43, .82);
        color: #fff;
        box-shadow: 0 6px 18px rgba(0,0,0,.18);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        font: 700 12px/1 system-ui, sans-serif;
      }
      #sarca-location-shortcut button:disabled { opacity: .68; }
      #sarca-location-shortcut .is-success { background: rgba(25,195,125,.9); color:#071321; border-color:#19c37d; }
      #sarca-location-shortcut .is-error { background: rgba(110,22,36,.9); border-color:rgba(255,160,160,.6); }
      #sarca-current-location-status {
        position: fixed;
        top: max(260px, 37vh);
        left: 28px;
        right: 44px;
        z-index: 1000;
        display: none;
        box-sizing: border-box;
        min-height: 40px;
        padding: 10px 14px;
        border-radius: 12px;
        background: rgba(255,255,255,.88);
        color: #53657a;
        box-shadow: 0 6px 18px rgba(0,0,0,.16);
        font: 700 13px/1.2 system-ui, sans-serif;
        pointer-events: none;
        backdrop-filter: blur(5px);
        -webkit-backdrop-filter: blur(5px);
      }
      #sarca-current-location-status.is-visible { display: block; }
      #sarca-current-location-status.is-pending { background: rgba(255,255,255,.96); color: #53657a; }
      /* A distância da rota fica no mapa/painel, nunca numa barra flutuante. */
      #sarca-current-location-status, #sarca-current-location-status.is-visible { display:none !important; }
      .sarca-rain-layer { pointer-events:none !important; opacity:.25 !important; }
      .sarca-night #sarca-weather-card { background: rgba(2, 9, 18, .30); }
      #sarCa-live-map-overlay {
        position: fixed;
        inset: 0;
        z-index: 8;
        display: none;
        pointer-events: none;
        overflow: hidden;
      }
      #sarCa-live-map-overlay.is-visible { display: block; }
      #sarCa-live-map-overlay .sarCa-live-route {
        fill: none;
        stroke: #1b5cff;
        stroke-width: 7;
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 2px 3px rgba(0,0,0,.38));
      }
      #sarCa-live-map-overlay .sarCa-live-route-shadow {
        fill: none;
        stroke: rgba(255,255,255,.88);
        stroke-width: 11;
        stroke-linecap: round;
        stroke-linejoin: round;
        opacity: .72;
      }
      #sarCa-live-map-overlay .sarCa-live-point { stroke: #fff; stroke-width: 3; }
      #sarCa-live-map-overlay .sarCa-live-driver { fill: #19c37d; }
      #sarCa-live-map-overlay .sarCa-live-rider { fill: #2d7dff; }
      #sarCa-live-map-overlay text {
        font: 700 12px system-ui, sans-serif;
        fill: #fff;
        paint-order: stroke;
        stroke: rgba(5,15,27,.9);
        stroke-width: 4px;
        stroke-linejoin: round;
      }
      #sarca-payment-toll-card {
        position: fixed;
        left: 12px;
        right: 12px;
        bottom: max(84px, env(safe-area-inset-bottom));
        z-index: 100;
        display: none;
        box-sizing: border-box;
        max-height: min(48vh, 390px);
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 12px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 16px;
        background: rgba(8, 20, 34, .82);
        color: rgba(255,255,255,.95);
        box-shadow: 0 8px 24px rgba(0,0,0,.22);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        font: 500 12px/1.3 system-ui, sans-serif;
        pointer-events: auto;
        touch-action: manipulation;
      }
      #sarca-payment-toll-card.is-visible { display: block; }
      #sarca-payment-toll-card .sarca-payment-toll__title { font-weight: 700; font-size: 13px; }
      #sarca-payment-toll-card .sarca-payment-toll__line { display:flex; justify-content:space-between; gap:8px; margin-top:4px; }
      #sarca-payment-toll-card .sarCa-payment-toll__route-line { margin-top:5px; color:#fff; font-size:11px; line-height:1.35; overflow-wrap:anywhere; }
      #sarca-payment-toll-card .sarCa-map-dashboard-route-estimate { margin-top:6px; color:#b6ffd9; font-size:11px; font-weight:750; }
      #sarca-payment-toll-card .sarca-payment-toll__muted { opacity:.72; }
      #sarca-payment-toll-card .sarca-payment-toll__actions { display:flex; gap:8px; margin-top:9px; }
      #sarca-payment-toll-card button { flex:1; min-height:32px; border:1px solid rgba(255,255,255,.22); border-radius:9px; background:rgba(255,255,255,.10); color:inherit; font:inherit; }
      #sarca-payment-toll-card button, #sarca-payment-toll-card input { pointer-events:auto; touch-action:manipulation; }
      #sarca-payment-toll-card button.is-selected { background:#19c37d; color:#071321; border-color:#19c37d; font-weight:700; }
      #sarca-payment-toll-card .sarca-price-choice { display:flex; gap:8px; margin-top:8px; }
      #sarca-payment-toll-card .sarca-price-choice button { min-height:34px; }
      #sarca-payment-toll-card .sarca-negotiation-input { display:none; width:100%; box-sizing:border-box; margin-top:8px; padding:8px 10px; border:1px solid rgba(255,255,255,.24); border-radius:9px; background:rgba(255,255,255,.08); color:inherit; font:inherit; }
      #sarca-payment-toll-card .sarca-negotiation-input.is-visible { display:block; }
      #sarca-payment-toll-card .sarca-payment-confirm { width:100%; margin-top:10px; min-height:38px; border:0; border-radius:10px; background:#19c37d; color:#071321; font-weight:800; }
      #sarca-payment-toll-card .sarca-payment-confirm:disabled { opacity:.62; }
      #sarca-payment-toll-card .sarca-payment-error { margin-top:7px; padding:7px 8px; border-radius:9px; background:rgba(255,92,92,.14); color:#ffd0d0; }
      #sarca-trip-state-card {
        position: fixed;
        top: auto;
        bottom: max(82px, calc(env(safe-area-inset-bottom) + 72px));
        left: 12px;
        right: 12px;
        z-index: 24;
        display: none;
        box-sizing: border-box;
        padding: 10px 12px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 14px;
        background: rgba(8, 20, 34, .68);
        color: rgba(255,255,255,.96);
        box-shadow: 0 6px 20px rgba(0,0,0,.16);
        backdrop-filter: blur(9px);
        -webkit-backdrop-filter: blur(9px);
        font: 500 12px/1.3 system-ui, sans-serif;
      }
      #sarca-trip-state-card.is-visible { display:block; }
      #sarca-trip-state-card.is-searching {
        max-height: min(18vh, 132px);
        padding: 8px 10px;
        background: rgba(8, 20, 34, .46);
        border-color: rgba(45,125,255,.32);
      }
      #sarca-trip-state-card.is-assigned { max-height: min(27vh, 245px); }
      #sarca-trip-state-card .sarca-trip-state__top { display:flex; justify-content:space-between; align-items:center; gap:8px; }
      #sarca-trip-state-card .sarca-trip-state__title { font-weight:750; }
      #sarca-trip-state-card .sarca-trip-state__meta { margin-top:3px; opacity:.78; }
      #sarca-trip-state-card .sarca-trip-state__pin { margin-top:7px; padding:6px 8px; border-radius:9px; background:rgba(25,195,125,.16); color:#a9ffd8; font-weight:750; letter-spacing:.08em; }
      #sarca-trip-state-card .sarca-trip-state__progress { display:flex; gap:4px; margin-top:8px; }
      #sarca-trip-state-card .sarca-trip-state__progress i { display:block; height:3px; flex:1; border-radius:99px; background:rgba(255,255,255,.18); }
      #sarca-trip-state-card .sarca-trip-state__progress i.is-done { background:#19c37d; }
      #sarca-trip-state-card .sarca-trip-state__distance-progress { margin-top:8px; height:7px; overflow:hidden; border-radius:99px; background:rgba(255,255,255,.16); }
      #sarca-trip-state-card .sarca-trip-state__distance-progress span { display:block; height:100%; min-width:3px; border-radius:inherit; background:linear-gradient(90deg,#2d7dff,#19c37d); transition:width .35s ease; }
      #sarca-trip-state-card .sarca-trip-state__route-note { margin-top:4px; color:#cfe2ff; font-size:10px; }
      #sarca-trip-state-card .sarCa-trip-state__maneuver { display:flex; align-items:center; gap:8px; margin-top:8px; padding:8px 9px; border-radius:10px; background:rgba(45,125,255,.18); border:1px solid rgba(45,125,255,.48); color:#fff; font-weight:800; }
      #sarca-trip-state-card .sarCa-trip-state__maneuver-icon { display:grid; place-items:center; width:28px; height:28px; border-radius:9px; background:#2d7dff; color:#fff; font-size:18px; line-height:1; flex:0 0 auto; }
      #sarca-nearby-drivers-card {
        position: fixed;
        top: max(68px, calc(env(safe-area-inset-top) + 60px));
        left: 18px;
        right: 18px;
        z-index: 19;
        display: none;
        box-sizing: border-box;
        padding: 3px 2px;
        border: 0;
        border-radius: 10px;
        background: transparent;
        color: #fff;
        box-shadow: none;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        font: 500 10px/1.2 system-ui, sans-serif;
        pointer-events: none;
      }
      #sarca-nearby-drivers-card.is-visible { display:block; }
      #sarca-nearby-drivers-card .sarca-nearby__header { display:flex; align-items:center; justify-content:center; gap:6px; }
      #sarca-nearby-drivers-card .sarca-nearby__title { font-weight:750; color:#dceaff; }
      #sarca-nearby-drivers-card .sarca-nearby__updated { color:#b9d4ff; font-size:9px; white-space:nowrap; opacity:.8; }
      #sarca-nearby-drivers-card .sarca-nearby__body { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:1px; }
      #sarca-nearby-drivers-card .sarca-nearby__radar { display:none; }
      #sarca-nearby-drivers-card .sarca-nearby__radar::before, #sarca-nearby-drivers-card .sarca-nearby__radar::after { content:""; position:absolute; background:rgba(255,255,255,.14); }
      #sarca-nearby-drivers-card .sarca-nearby__radar::before { left:50%; top:5px; bottom:5px; width:1px; }
      #sarca-nearby-drivers-card .sarca-nearby__radar::after { top:50%; left:5px; right:5px; height:1px; }
      #sarca-nearby-drivers-card .sarca-nearby__center, #sarca-nearby-drivers-card .sarca-nearby__dot { position:absolute; width:7px; height:7px; border-radius:50%; transform:translate(-50%,-50%); z-index:1; }
      #sarca-nearby-drivers-card .sarca-nearby__center { left:50%; top:50%; background:#fff; box-shadow:0 0 0 3px rgba(45,125,255,.28); }
      #sarca-nearby-drivers-card .sarca-nearby__dot { background:#19c37d; box-shadow:0 0 0 3px rgba(25,195,125,.22); }
      #sarca-nearby-drivers-card .sarca-nearby__list { display:grid; gap:3px; min-width:0; }
      #sarca-nearby-drivers-card .sarca-nearby__driver { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#f4f8ff; }
      #sarca-nearby-drivers-card .sarca-nearby__muted { color:#c8dcff; opacity:.85; }
      #sarca-trip-extra-card {
        position: fixed;
        /* Keep the accepted-trip card below the map, above the navigation,
           so the passenger can keep the route and driver marker in view. */
        top: auto;
        bottom: max(84px, calc(env(safe-area-inset-bottom) + 74px));
        left: 12px;
        right: 12px;
        z-index: 23;
        display: none;
        max-height: min(34vh, 300px);
        overflow: auto;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 14px;
        background: rgba(8, 20, 34, .72);
        color: rgba(255,255,255,.96);
        box-shadow: 0 6px 20px rgba(0,0,0,.16);
        backdrop-filter: blur(9px);
        -webkit-backdrop-filter: blur(9px);
        font: 500 12px/1.3 system-ui, sans-serif;
      }
      #sarca-trip-extra-card.is-visible { display:block; }
      #sarca-trip-extra-card.is-payment-required { border-color:rgba(25,195,125,.72); box-shadow:0 0 0 2px rgba(25,195,125,.14), 0 8px 24px rgba(0,0,0,.22); }
      body.sarCa-payment-settled-flash #sarca-trip-extra-card { animation:sarCa-payment-settled .9s ease-out; }
      @keyframes sarCa-payment-settled { 0% { transform:scale(1); box-shadow:0 0 0 0 rgba(25,195,125,.7); } 35% { transform:scale(1.015); box-shadow:0 0 0 8px rgba(25,195,125,.18); } 100% { transform:scale(1); box-shadow:0 0 0 0 rgba(25,195,125,0); } }
      .sarca-extra__header { display:flex; justify-content:space-between; align-items:center; gap:8px; font-weight:750; }
      .sarca-extra__muted { opacity:.72; font-size:10px; }
      .sarca-extra__identity { display:flex; align-items:center; gap:9px; margin-top:8px; }
      .sarca-extra__identity--driver-card { align-items:flex-start; gap:12px; margin-top:10px; padding:12px; border:1px solid rgba(25,195,125,.72); border-radius:16px; background:linear-gradient(135deg,rgba(25,195,125,.24),rgba(10,52,42,.82)); box-shadow:0 8px 24px rgba(0,0,0,.2); }
      .sarca-extra__identity--driver-card .sarca-extra__avatar { flex:0 0 58px; width:58px; height:58px; border:2px solid rgba(190,255,224,.82); box-shadow:0 4px 14px rgba(0,0,0,.24); }
      .sarca-extra__identity--driver-card .sarca-extra__identity-copy { padding-top:1px; }
      .sarca-extra__identity--driver-card .sarca-extra__identity-facts { margin-top:10px; }
      .sarca-extra__identity--driver-card .sarca-extra__identity-fact--primary { background:rgba(25,195,125,.26); border-color:rgba(174,255,216,.64); }
      .sarca-extra__driver-name { margin-top:8px; font-size:18px; line-height:1.15; font-weight:900; color:#fff; }
      .sarca-extra__avatar { width:34px; height:34px; border-radius:50%; object-fit:cover; background:rgba(255,255,255,.12); display:grid; place-items:center; font-size:18px; }
      .sarca-extra__identity strong { display:block; font-size:17px; line-height:1.15; color:#fff; }
      .sarca-extra__identity-copy { flex:1; min-width:0; }
      .sarca-extra__identity-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; margin-top:9px; }
      .sarca-extra__identity-fact { display:flex; flex-direction:column; gap:2px; padding:7px 8px; border-radius:9px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.12); min-width:0; }
      .sarca-extra__identity-fact--primary { background:rgba(28,111,255,.22); border-color:rgba(94,157,255,.5); }
      .sarca-extra__identity-fact-label { font-size:9px; text-transform:uppercase; letter-spacing:.06em; opacity:.7; }
      .sarca-extra__identity-fact-value { font-size:12px; font-weight:800; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .sarca-extra__offer { margin-top:8px; padding:9px; border:1px solid rgba(255,255,255,.14); border-radius:11px; background:rgba(255,255,255,.06); }
      .sarca-extra__offer-top { display:flex; justify-content:space-between; gap:8px; align-items:center; }
      .sarca-extra__offer-price { font-weight:800; color:#a9ffd8; white-space:nowrap; }
      .sarca-extra__offer button { width:100%; margin-top:7px; min-height:32px; border:0; border-radius:9px; background:#19c37d; color:#071321; font:inherit; font-weight:750; }
      .sarca-extra__identity span { display:block; opacity:.75; margin-top:2px; font-size:10px; }
      .sarca-extra__line { margin-top:7px; padding:7px 8px; border-radius:9px; background:rgba(255,255,255,.07); }
      .sarca-extra__actions { display:flex; gap:7px; margin-top:8px; }
      .sarca-extra__actions button, .sarca-extra__actions a { flex:1; min-height:30px; display:inline-flex; align-items:center; justify-content:center; padding:5px 8px; border:1px solid rgba(255,255,255,.2); border-radius:9px; background:rgba(255,255,255,.1); color:inherit; text-decoration:none; font:inherit; }
      .sarca-extra__actions button.has-unread { border-color:rgba(45,125,255,.9); background:rgba(45,125,255,.18); }
      .sarCa-rider-chat-badge { display:inline-grid; place-items:center; min-width:16px; height:16px; margin-left:5px; padding:0 4px; box-sizing:border-box; border-radius:99px; background:#e85d68; color:#fff; font:800 9px/1 system-ui,sans-serif; }
      .sarca-extra__actions button.is-danger { border-color:rgba(255,122,122,.55); color:#ffd0d0; }
      .sarca-extra__receipt { margin-top:8px; padding-top:8px; border-top:1px solid rgba(255,255,255,.14); }
      .sarca-extra__primary-action { width:100%; min-height:36px; margin-top:10px; border:0; border-radius:10px; background:#19c37d; color:#071321; font:inherit; font-weight:800; cursor:pointer; }
      .sarca-extra__primary-action:disabled { opacity:.65; cursor:wait; }
      .sarca-extra__receipt-row { display:flex; justify-content:space-between; gap:8px; margin-top:4px; }
      .sarca-extra__stars { display:flex; gap:3px; margin-top:6px; }
      .sarca-extra__stars button { border:0; background:transparent; color:rgba(255,255,255,.32); font-size:23px; padding:0 2px; cursor:pointer; }
      .sarca-extra__stars button.is-selected { color:#f7b733; }
      .sarca-extra__notice { margin-top:7px; padding:7px 8px; border-radius:9px; background:rgba(32,199,119,.12); color:#baffdd; }
      .sarca-extra__warning { margin-top:7px; padding:8px; border-radius:9px; background:rgba(255,183,77,.14); border:1px solid rgba(255,183,77,.34); color:#ffe1aa; }
      .sarca-extra__warning button { width:100%; margin-top:7px; min-height:31px; border:1px solid rgba(255,255,255,.24); border-radius:9px; background:rgba(255,255,255,.12); color:inherit; font:inherit; font-weight:700; }
      .sarca-trip-details { margin-top:8px; padding:8px; border-radius:10px; background:rgba(3,12,26,.28); border:1px solid rgba(255,255,255,.12); }
      .sarca-trip-details__title { font-weight:750; }
      .sarca-trip-details__row { display:flex; justify-content:space-between; gap:10px; margin-top:5px; }
      .sarca-trip-details__row span:first-child { opacity:.72; }
      .sarca-trip-details__row span:last-child { text-align:right; font-weight:650; }
      .sarca-cancel-reasons { margin-top:8px; padding:8px; border-radius:10px; background:rgba(70,12,24,.24); border:1px solid rgba(255,122,122,.3); }
      .sarca-cancel-reasons__title { color:#ffd0d0; font-weight:750; }
      .sarca-cancel-reasons button { width:100%; margin-top:6px; min-height:32px; padding:6px 8px; border:1px solid rgba(255,190,190,.28); border-radius:9px; background:rgba(255,255,255,.08); color:inherit; font:inherit; text-align:left; }
      .sarca-voice-control { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:7px; font-size:10px; opacity:.86; }
      .sarca-voice-control button { min-height:25px; padding:3px 7px; border:1px solid rgba(255,255,255,.2); border-radius:8px; background:rgba(255,255,255,.1); color:inherit; font:inherit; }
      .sarca-reference__label { display:block; margin-top:8px; font-size:10px; opacity:.76; }
      .sarca-reference__input { width:100%; box-sizing:border-box; margin-top:4px; padding:8px 9px; border:1px solid rgba(255,255,255,.2); border-radius:9px; background:rgba(255,255,255,.08); color:inherit; font:inherit; outline:none; }
      .sarca-reference__input:focus { border-color:#1b5cff; }
      @media (min-width: 700px) { #sarca-weather-card { width: 270px; } }
      /* Keep the map surface stable while the search state changes. The
         Flutter scene owns the map styling; this only removes browser-level
         filters that can make the whole scene look washed out. */
      flt-scene-host { filter: none !important; }
      flt-scene-host canvas { filter: none !important; }
      body.sarca-searching flt-scene-host { filter: none !important; }
      /* The current SARCA experience is map-first. The Flutter scene remains
         mounted as the request/auth engine, but its legacy dashboard is
         visually covered so it cannot reappear over the full-map surface. */
      #sarCa-full-map-surface {
        position: fixed;
        inset: 0;
        z-index: 7;
        overflow: hidden;
         background-color: #eaf1f7;
        background-position: center;
        background-size: cover;
        background-repeat: no-repeat;
        pointer-events: auto;
      }
      #sarCa-full-map-surface::after {
        content: '';
        position: absolute;
        inset: 0;
         background: transparent;
        pointer-events: none;
      }
      #sarCa-full-map-canvas { position:absolute; inset:0; opacity:1; }
      #sarCa-full-map-canvas .mapboxgl-control-container { display:none; }
      #sarCa-full-map-surface .mapboxgl-canvas { width:100%; height:100%; }
      .sarCa-assigned-driver-marker { display:flex; flex-direction:column; align-items:center; gap:2px; transform:translateY(-4px); pointer-events:none; filter:drop-shadow(0 2px 4px rgba(0,0,0,.36)); }
      .sarCa-assigned-driver-marker span { display:flex; align-items:center; justify-content:center; width:34px; height:34px; border:3px solid #fff; border-radius:50%; background:#19c37d; font-size:18px; line-height:1; }
      .sarCa-assigned-driver-marker b { padding:2px 5px; border-radius:6px; background:rgba(5,24,38,.88); color:#fff; font:800 10px/1 system-ui,sans-serif; white-space:nowrap; }
      .sarCa-assigned-driver-overlay { position:absolute; z-index:9; display:flex; align-items:center; justify-content:center; width:44px; height:44px; transform:translate(-50%,-100%); pointer-events:none; filter:drop-shadow(0 2px 4px rgba(0,0,0,.42)); }
      .sarCa-assigned-driver-overlay span, .sarCa-rider-location-marker span { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border:2px solid #fff; border-radius:50% 50% 50% 0; background:#19c37d; font-size:14px; line-height:1; transform:rotate(-45deg); }
      .sarCa-assigned-driver-overlay span i, .sarCa-rider-location-marker span i { display:block; font-style:normal; transform:rotate(45deg); }
      .sarCa-assigned-driver-overlay b { padding:3px 6px; border-radius:6px; background:rgba(5,24,38,.94); color:#fff; font:800 11px/1 system-ui,sans-serif; white-space:nowrap; }
      .sarCa-rider-location-marker { width:44px; height:44px; display:flex; align-items:center; justify-content:center; pointer-events:none; filter:drop-shadow(0 2px 4px rgba(0,0,0,.42)); }
      .sarCa-rider-location-marker span { background:#7c3aed; width:24px; height:24px; font-size:12px; }
      @keyframes sarCa-driver-arrived-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(25,195,125,.55); } 50% { box-shadow:0 0 0 9px rgba(25,195,125,0); } }
      .sarCa-assigned-driver-overlay.is-arrived span { animation:sarCa-driver-arrived-pulse 1.15s ease-in-out infinite; background:#16a34a; }
      .sarCa-assigned-driver-overlay.is-stale span { filter:grayscale(.72); opacity:.68; }
      .sarCa-assigned-driver-marker { width:44px; height:48px; display:grid; place-items:center; pointer-events:none; filter:drop-shadow(0 3px 5px rgba(0,0,0,.42)); }
      .sarCa-assigned-driver-marker span { display:grid; place-items:center; width:28px; height:28px; border:2px solid #fff; border-radius:50% 50% 50% 0; background:#19c37d; font-size:14px; line-height:1; transform:rotate(calc(-45deg + var(--sarCa-heading, 0deg))); transition:background .18s ease, filter .18s ease, opacity .18s ease; }
      .sarCa-assigned-driver-marker span i { display:block; font-style:normal; transform:rotate(45deg); }
      .sarCa-assigned-driver-marker.is-arrived span { animation:sarCa-driver-arrived-pulse 1.15s ease-in-out infinite; background:#16a34a; }
      .sarCa-assigned-driver-marker.is-stale span { filter:grayscale(.72); opacity:.68; }
      .sarCa-passenger-recenter-button { position:fixed; top:max(78px,calc(env(safe-area-inset-top) + 70px)); left:50%; transform:translateX(-50%); z-index:28; border:1px solid rgba(255,255,255,.72); border-radius:999px; padding:9px 15px; background:#1769ff; color:#fff; box-shadow:0 7px 20px rgba(0,0,0,.28); font:800 12px/1 system-ui,sans-serif; cursor:pointer; }
      .sarCa-passenger-recenter-button[hidden] { display:none !important; }
      .sarCa-full-map-ready #sarCa-full-map-surface { display:block; }
      #sarCa-map-dashboard-shell { position:fixed; inset:0; z-index:30; pointer-events:none; font-family:system-ui,sans-serif; }
      #sarCa-map-dashboard-topbar { position:fixed; top:max(10px,env(safe-area-inset-top)); left:12px; right:12px; min-height:42px; display:flex; align-items:center; justify-content:space-between; gap:10px; padding:4px 0; box-sizing:border-box; border:0; border-radius:0; background:transparent; color:#fff; box-shadow:none; backdrop-filter:none; -webkit-backdrop-filter:none; pointer-events:auto; }
      #sarCa-map-dashboard-topbar strong { font-size:16px; letter-spacing:.01em; }
      #sarCa-map-dashboard-topbar .sarCa-map-dashboard-brand { color:#2d7dff; }
      #sarCa-map-dashboard-topbar .sarCa-map-dashboard-actions { display:flex; gap:6px; }
      #sarCa-map-dashboard-topbar button { position:relative; width:34px; height:34px; border:1px solid rgba(45,125,255,.72); border-radius:50%; background:rgba(4,24,54,.32); color:#2d7dff; font-size:16px; box-shadow:0 4px 14px rgba(0,0,0,.18); }
      #sarCa-map-dashboard-topbar.sarCa-map-dashboard-topbar--minimal .sarCa-map-dashboard-brand { color:#2d7dff; text-shadow:0 1px 8px rgba(0,0,0,.32); }
      #sarCa-map-dashboard-topbar.sarCa-map-dashboard-topbar--minimal .sarCa-map-dashboard-notifications { color:#2d7dff; }
      #sarCa-map-dashboard-topbar .sarCa-map-dashboard-notifications.has-unread { border-color:#2d7dff; box-shadow:0 0 0 3px rgba(45,125,255,.16), 0 4px 14px rgba(0,0,0,.18); }
      .sarCa-rider-notification-badge { position:absolute; top:-5px; right:-5px; min-width:16px; height:16px; padding:0 4px; display:grid; place-items:center; box-sizing:border-box; border:2px solid #071522; border-radius:99px; background:#e85d68; color:#fff; font:800 9px/1 system-ui,sans-serif; }
      #sarca-weather-card, .sarca-rain-layer, .sarca-heat-dialog { display:none !important; }
      #sarCa-map-dashboard-panel { position:fixed; left:12px; right:12px; bottom:78px; max-height:min(36vh,330px); overflow:auto; box-sizing:border-box; padding:13px 14px 14px; border:1px solid rgba(255,255,255,.2); border-radius:20px; background:rgba(5,20,38,.88); color:#fff; box-shadow:0 10px 28px rgba(0,0,0,.24); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); pointer-events:auto; }
      #sarCa-map-dashboard-panel.has-suggestions { min-height:min(48vh,440px); max-height:min(58vh,520px); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-grabber { width:38px; height:4px; margin:0 auto 10px; border-radius:99px; background:rgba(255,255,255,.4); }
      #sarCa-map-dashboard-panel h2 { margin:0; font-size:18px; line-height:1.2; }
      #sarCa-map-dashboard-panel p { margin:4px 0 10px; color:#c8dcff; font-size:11px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-service-choice { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:10px 0 12px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-service-choice button { min-height:42px; border:1px solid rgba(255,255,255,.18); border-radius:12px; background:rgba(255,255,255,.08); color:rgba(255,255,255,.78); font:800 12px system-ui,sans-serif; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-service-choice button.is-active { border-color:#2d7dff; background:rgba(45,125,255,.28); color:#fff; box-shadow:0 0 0 2px rgba(45,125,255,.12); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-section-label { margin:0 0 5px; color:#c8dcff; font-size:11px; font-weight:800; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-location { display:flex; align-items:center; gap:8px; margin-top:0; padding:7px 9px; border:1px solid rgba(255,255,255,.18); border-radius:12px; background:rgba(255,255,255,.09); font-size:12px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-location-icon { flex:0 0 auto; font-size:16px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-pickup { min-width:0; flex:1 1 auto; border:0; outline:none; background:transparent; color:#fff; font:600 13px system-ui,sans-serif; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-pickup::placeholder { color:rgba(255,255,255,.7); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-location-button { flex:0 0 auto; width:31px; height:31px; padding:0; border:0; border-radius:9px; background:#2d7dff; color:#fff; font-size:20px; line-height:1; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-location-hint { margin:4px 2px 7px; color:rgba(255,255,255,.55); font-size:10px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-destination { width:100%; box-sizing:border-box; margin-top:8px; padding:11px 12px; border:1px solid rgba(255,255,255,.2); border-radius:12px; outline:none; background:rgba(255,255,255,.09); color:#fff; font:500 13px system-ui,sans-serif; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-destination::placeholder { color:rgba(255,255,255,.66); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-destination:focus { border-color:#2d7dff; box-shadow:0 0 0 3px rgba(45,125,255,.18); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-delivery-details { display:grid; gap:6px; margin-top:9px; padding:9px; border:1px solid rgba(45,125,255,.28); border-radius:12px; background:rgba(45,125,255,.08); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-delivery-details[hidden] { display:none; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-delivery-title { color:#fff; font-size:12px; font-weight:800; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-delivery-hint { color:rgba(255,255,255,.64); font-size:10px; line-height:1.3; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-delivery-input { width:100%; min-height:34px; box-sizing:border-box; padding:8px 9px; border:1px solid rgba(255,255,255,.18); border-radius:9px; outline:none; background:rgba(255,255,255,.09); color:#fff; font:500 11px system-ui,sans-serif; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-delivery-input::placeholder { color:rgba(255,255,255,.62); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-delivery-input option { color:#071321; background:#fff; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-choice { display:grid; gap:6px; margin-top:10px; padding:10px; border:1px solid rgba(45,125,255,.34); border-radius:12px; background:rgba(45,125,255,.10); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-choice[hidden] { display:none; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-title { color:#fff; font-size:12px; font-weight:800; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-hint { color:rgba(255,255,255,.68); font-size:10px; line-height:1.3; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-grid button { min-height:58px; padding:8px 9px; display:flex; flex-direction:column; align-items:flex-start; justify-content:center; gap:4px; border:1px solid rgba(255,255,255,.18); border-radius:10px; background:rgba(255,255,255,.08); color:rgba(255,255,255,.82); font:800 10px/1.15 system-ui,sans-serif; text-align:left; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-grid button:disabled { opacity:.62; cursor:wait; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-name { font-size:11px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-price { color:#9fffd3; font-size:12px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-availability { color:rgba(255,255,255,.62); font-size:9px; line-height:1.25; font-weight:600; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-availability.is-ready { color:#9fffd3; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-availability.is-empty { color:#ffd28a; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-category-grid button.is-active { border-color:#2d7dff; background:rgba(45,125,255,.32); color:#fff; box-shadow:0 0 0 2px rgba(45,125,255,.14); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-route-action { width:100%; min-height:38px; margin-top:9px; border:0; border-radius:11px; background:#19c37d; color:#071321; font:800 12px system-ui,sans-serif; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-route-action:disabled { opacity:.65; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-tab-view { display:flex; flex-direction:column; gap:8px; margin-top:12px; padding-top:4px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-tab-view[hidden], #sarCa-map-dashboard-panel .sarCa-map-dashboard-service-choice[hidden], #sarCa-map-dashboard-panel .sarCa-map-dashboard-route-action[hidden] { display:none !important; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-tab-icon { width:38px; height:38px; display:grid; place-items:center; border-radius:12px; background:rgba(45,125,255,.18); font-size:20px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-tab-view strong { font-size:13px; color:#fff; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-tab-view > span { color:rgba(255,255,255,.68); font-size:11px; line-height:1.4; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-item { display:block; overflow:hidden; padding:0; border:1px solid rgba(255,255,255,.14); border-radius:11px; background:rgba(255,255,255,.06); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-summary { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px; cursor:pointer; list-style:none; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-summary::-webkit-details-marker { display:none; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-summary:after { content:'＋'; flex:0 0 auto; color:#8db8ff; font-size:16px; line-height:1; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-item[open] .sarCa-map-dashboard-trip-summary:after { content:'−'; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-summary-copy { min-width:0; display:flex; flex-direction:column; gap:4px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-summary strong { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-summary span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:rgba(255,255,255,.66); font-size:10px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-summary b { flex:0 0 auto; color:#a9ffd8; font-size:11px; white-space:nowrap; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-details { display:flex; flex-direction:column; gap:8px; padding:0 10px 10px; border-top:1px solid rgba(255,255,255,.1); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-details-section { display:flex; flex-direction:column; gap:5px; padding-top:8px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-details-title { color:#9fc3ff; font-size:11px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-detail-row { display:grid; grid-template-columns:105px minmax(0,1fr); gap:8px; align-items:start; padding:4px 0; border-bottom:1px solid rgba(255,255,255,.07); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-detail-row:last-child { border-bottom:0; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-detail-row > span { color:rgba(255,255,255,.62); font-size:10px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-detail-row > strong { min-width:0; color:#fff; font-size:10px; line-height:1.3; overflow-wrap:anywhere; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-route > strong { color:#b6ffd9; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-details-loading, #sarCa-map-dashboard-panel .sarCa-map-dashboard-trip-details-note { padding:8px 0 0; color:rgba(255,255,255,.66); font-size:10px; line-height:1.35; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-view { gap:7px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-row { display:flex; align-items:center; gap:10px; padding:9px 10px; border:1px solid rgba(255,255,255,.14); border-radius:12px; background:rgba(255,255,255,.06); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-row-icon { flex:0 0 24px; font-size:18px; text-align:center; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-row-copy { min-width:0; display:flex; flex-direction:column; gap:2px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-row-copy strong { font-size:12px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-row-copy span { color:rgba(255,255,255,.68); font-size:10px; line-height:1.25; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-identity { display:flex; align-items:center; gap:10px; padding:9px 10px; border:1px solid rgba(255,255,255,.14); border-radius:13px; background:rgba(255,255,255,.06); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-avatar { width:42px; height:42px; display:grid; place-items:center; overflow:hidden; border-radius:50%; background:rgba(45,125,255,.2); font-size:22px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-avatar img { width:100%; height:100%; object-fit:cover; display:block; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-identity-copy { min-width:0; display:flex; flex-direction:column; gap:3px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-identity-copy strong { font-size:14px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-identity-copy span { color:rgba(255,255,255,.68); font-size:10px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-stat { display:flex; flex-direction:column; gap:3px; padding:8px 7px; border-radius:10px; background:rgba(255,255,255,.06); text-align:center; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-stat span { color:rgba(255,255,255,.62); font-size:9px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-stat strong { font-size:11px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-card { display:flex; flex-direction:column; gap:6px; padding:10px; border:1px solid rgba(255,255,255,.14); border-radius:13px; background:rgba(255,255,255,.06); }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-card > strong { font-size:12px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-card > span { color:rgba(255,255,255,.68); font-size:10px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-wallet-balance { color:#a9ffd8; font-size:16px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-actions { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; margin-top:3px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-actions button, #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-menu button { min-height:32px; border:1px solid rgba(45,125,255,.42); border-radius:9px; background:rgba(45,125,255,.14); color:#fff; font:700 11px system-ui,sans-serif; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-menu { display:grid; grid-template-columns:repeat(2,1fr); gap:7px; margin-top:2px; }
      #sarCa-map-dashboard-panel .sarCa-map-dashboard-profile-muted { color:rgba(255,255,255,.52) !important; }
      #sarCa-map-dashboard-panel.is-history, #sarCa-map-dashboard-panel.is-profile { max-height:min(64vh,560px); }
      .sarCa-map-dashboard-profile-sheet { position:fixed; left:16px; right:16px; bottom:78px; z-index:60; max-height:min(68vh,560px); overflow:auto; box-sizing:border-box; padding:15px; border:1px solid rgba(45,125,255,.45); border-radius:18px; background:rgba(5,20,38,.98); color:#fff; box-shadow:0 14px 36px rgba(0,0,0,.42); font:500 12px/1.35 system-ui,sans-serif; }
      .sarCa-profile-sheet-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:12px; }
      .sarCa-profile-sheet-heading { display:flex; flex-direction:column; gap:3px; }
      .sarCa-profile-sheet-heading strong { font-size:16px; }
      .sarCa-profile-sheet-heading span { color:#c8dcff; font-size:10px; }
      .sarCa-profile-sheet-close { width:30px; height:30px; border:1px solid rgba(255,255,255,.2); border-radius:9px; background:rgba(255,255,255,.1); color:#fff; font-size:20px; line-height:1; }
      .sarCa-profile-sheet-input { width:100%; box-sizing:border-box; margin-top:8px; padding:11px 12px; border:1px solid rgba(255,255,255,.2); border-radius:10px; outline:none; background:rgba(255,255,255,.09); color:#fff; font:inherit; }
      .sarCa-profile-sheet-input::placeholder { color:rgba(255,255,255,.58); }
      .sarCa-profile-sheet-textarea { min-height:110px; resize:vertical; }
      .sarCa-profile-sheet-file { width:100%; margin:10px 0; color:#c8dcff; font:inherit; }
      .sarCa-profile-sheet-primary, .sarCa-profile-sheet-danger { width:100%; min-height:38px; margin-top:10px; border:0; border-radius:10px; background:#19c37d; color:#071321; font:800 12px system-ui,sans-serif; }
      .sarCa-profile-sheet-danger { background:#e85d68; color:#fff; }
      .sarCa-profile-sheet-primary:disabled, .sarCa-profile-sheet-danger:disabled { opacity:.6; }
      .sarCa-profile-sheet-message { margin-top:10px; padding:9px; border-radius:10px; background:rgba(255,255,255,.09); color:#dceaff; }
      .sarCa-profile-sheet-message.is-success { background:rgba(25,195,125,.14); color:#baffdd; }
      .sarCa-profile-sheet-message.is-error { background:rgba(232,93,104,.16); color:#ffd0d0; }
      .sarCa-profile-sheet-list { display:grid; gap:7px; max-height:270px; overflow:auto; }
      .sarCa-profile-sheet-notification { display:flex; flex-direction:column; gap:2px; padding:9px; border:1px solid rgba(255,255,255,.14); border-radius:9px; background:rgba(255,255,255,.06); }
      .sarCa-profile-sheet-notification.is-unread { border-color:rgba(45,125,255,.72); background:rgba(45,125,255,.12); }
      .sarCa-profile-sheet-notification strong { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .sarCa-profile-sheet-unread-label { color:#8db8ff; font-size:9px; font-weight:800; text-transform:uppercase; }
      .sarCa-profile-sheet-notification-time { margin-top:3px; color:rgba(255,255,255,.48); font-size:9px; font-weight:500; }
      .sarCa-profile-sheet-notification span, .sarCa-profile-sheet-terms { color:#c8dcff; font-size:11px; }
      .sarCa-profile-sheet-terms { margin:0; line-height:1.5; }
      #sarCa-map-dashboard-nav { position:fixed; left:0; right:0; bottom:0; min-height:66px; padding:max(7px,env(safe-area-inset-bottom)) 18px 7px; box-sizing:border-box; display:grid; grid-template-columns:repeat(3,1fr); gap:8px; border-top:1px solid rgba(255,255,255,.12); background:rgba(3,15,29,.94); color:#fff; pointer-events:auto; }
      #sarCa-map-dashboard-nav button { border:0; border-radius:12px; background:transparent; color:rgba(255,255,255,.7); font:600 11px/1.15 system-ui,sans-serif; }
      #sarCa-map-dashboard-nav button span { display:block; font-size:18px; margin-bottom:3px; }
      #sarCa-map-dashboard-nav button.is-active { color:#fff; background:rgba(45,125,255,.2); }
      #sarCa-map-dashboard-panel.is-history h2:before { content:'🚗 '; }
      #sarCa-map-dashboard-panel.is-profile h2:before { content:'👤 '; }
      #sarCa-map-dashboard-panel.is-summary { display:none; }
      #sarCa-map-dashboard-panel.is-trip-active { display:none; }
      #sarCa-map-dashboard-panel.is-trip-active.is-history, #sarCa-map-dashboard-panel.is-trip-active.is-profile { display:block; }
      #sarCa-map-dashboard-shell ~ #sarca-weather-card { top:max(12px,env(safe-area-inset-top)); }
      /* O clima fica no cabeçalho, entre SARCA e o sino, sem criar outro cartão. */
      #sarCa-map-dashboard-topbar #sarca-weather-card { position:static; top:auto; left:auto; right:auto; transform:none; width:min(142px,38vw); min-width:0; margin:0 auto; padding:0; border:0; border-radius:0; background:transparent; box-shadow:none; backdrop-filter:none; -webkit-backdrop-filter:none; pointer-events:auto; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__panel, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__panel { padding:0; border:0; background:transparent; box-shadow:none; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__location-copy, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__location-copy, #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__location-button, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__location-button { display:none; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__rain-copy, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__rain-copy { display:none; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__top, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__top { justify-content:center; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__row, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__row { justify-content:center; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__condition span, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__condition span { display:none; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__eyebrow, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__eyebrow { color:#2d7dff; }
      #sarCa-map-dashboard-topbar #sarca-weather-card .sarCa-weather__updated, #sarCa-map-dashboard-topbar #sarca-weather-card .sarca-weather__condition strong { color:#dceaff; }
      #sarca-trip-state-card.is-accepted-hidden { display:none !important; }
      /* Não repetir o painel textual de motoristas: as posições reais ficam no mapa. */
      #sarca-nearby-drivers-card { display:none !important; }
      #sarCa-live-map-overlay { display:none !important; }
      /* O mapa permanece por trás das abas; os cartões do mapa só aparecem
         no Início. A procura continua ativa quando se muda de aba. */
      body.sarCa-map-tab-not-home #sarca-trip-state-card,
      body.sarCa-map-tab-not-home #sarca-trip-extra-card,
      body.sarCa-map-tab-not-home #sarca-payment-toll-card,
      body.sarCa-map-tab-not-home #sarca-current-location-status,
      body.sarCa-map-tab-not-home #sarca-nearby-drivers-card,
      body.sarCa-map-tab-not-home #sarCa-live-map-overlay,
      body.sarCa-map-tab-not-home .sarca-driver-search-overlay,
      body.sarCa-map-tab-not-home .sarCa-passenger-recenter-button { display:none !important; }
      .sarCa-passenger-confirm-modal { position:fixed; inset:0; z-index:100; display:grid; place-items:center; padding:20px; box-sizing:border-box; background:rgba(2,9,18,.58); backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px); }
      .sarCa-passenger-confirm-dialog { width:min(420px,100%); box-sizing:border-box; padding:18px; border:1px solid rgba(45,125,255,.5); border-radius:18px; background:#071a31; color:#fff; box-shadow:0 18px 50px rgba(0,0,0,.46); font:500 13px/1.4 system-ui,sans-serif; }
      .sarCa-passenger-confirm-dialog h2 { margin:0; color:#fff; font-size:17px; line-height:1.2; }
      .sarCa-passenger-confirm-dialog p { margin:10px 0 16px; color:#c8dcff; }
      .sarCa-passenger-confirm-actions { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
      .sarCa-passenger-confirm-actions button { min-height:42px; border:1px solid rgba(45,125,255,.55); border-radius:11px; padding:9px 10px; color:#fff; background:rgba(45,125,255,.2); font:750 12px system-ui,sans-serif; }
      .sarCa-passenger-confirm-actions button.is-danger { border-color:rgba(255,120,120,.78); background:#b3263b; color:#fff; }
      .sarCa-rider-action-toast { position:fixed; left:50%; bottom:max(84px,calc(env(safe-area-inset-bottom) + 76px)); z-index:95; transform:translateX(-50%); max-width:min(88vw,420px); padding:10px 14px; border:1px solid rgba(45,125,255,.5); border-radius:12px; background:rgba(7,26,49,.96); color:#fff; box-shadow:0 10px 28px rgba(0,0,0,.32); font:750 12px/1.25 system-ui,sans-serif; text-align:center; }
    `;
    document.head.appendChild(style);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function number(value) {
    return typeof value === 'number' && isFinite(value) ? value : null;
  }

  function round(value) {
    return value == null ? '--' : Math.round(value) + '°';
  }

  function localDay() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }

  function updatedLabel() {
    return weather.updatedAt ? weather.scope + ' · ' + weather.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'A aguardar localização';
  }

  function renderCard() {
    if (!card) return;
    card.innerHTML = '';
    var top = el('div', 'sarca-weather__top');
    top.appendChild(el('span', 'sarca-weather__eyebrow', 'Clima na tua zona'));
    top.appendChild(el('span', 'sarca-weather__updated', updatedLabel()));
    card.appendChild(top);
    var row = el('div', 'sarca-weather__row');
    var icon = weather.rain ? '🌧️' : (weather.temperature != null && weather.temperature >= 30 ? '☀️' : '⛅');
    row.appendChild(el('span', 'sarca-weather__icon', icon));
    row.appendChild(el('strong', 'sarca-weather__temp', round(weather.temperature)));
    var condition = el('div', 'sarca-weather__condition');
    condition.appendChild(el('strong', '', weather.label));
    condition.appendChild(el('span', '', 'Mín ' + round(weather.minimum) + ' · Máx ' + round(weather.maximum)));
    row.appendChild(condition);
    card.appendChild(row);
    if (weather.rain) card.appendChild(el('div', 'sarca-weather__rain-copy', 'Está a chover na tua zona. Prepara-te para a viagem.'));
    if (weather.locationRequired) {
      card.appendChild(el('div', 'sarca-weather__location-copy', 'Permite a localização para ver o clima real da tua zona.'));
      var locationButton = el('button', 'sarca-weather__location-button', 'Ativar localização');
      locationButton.addEventListener('click', requestLocation);
      card.appendChild(locationButton);
    }
    card.classList.toggle('is-loading', weather.loading);
    card.classList.toggle('location-required', weather.locationRequired);
  }

  function setTheme() {
    var hour = new Date().getHours();
    document.body.classList.toggle('sarca-night', hour >= 18 || hour < 6);
  }

  function setRain(enabled) {
    document.body.classList.toggle('sarca-raining', enabled);
    if (rainLayer) rainLayer.hidden = !enabled;
  }

  function showHeatWarning() {
    if (weather.temperature == null || weather.temperature <= 36) return;
    var key = 'sarca-heat-warning-' + localDay();
    if (localStorage.getItem(key) === '1' || heatDialog) return;
    localStorage.setItem(key, '1');
    heatDialog = el('div', 'sarca-heat-dialog');
    var panel = el('div', 'sarca-heat-dialog__panel');
    panel.appendChild(el('div', 'sarca-heat-dialog__icon', '💧'));
    panel.appendChild(el('h2', '', 'Muito calor')); 
    panel.appendChild(el('p', '', 'Muito calor por aí! Bebe água e mantém-te hidratado.')); 
    var button = el('button', '', 'Entendido');
    button.addEventListener('click', function () { if (heatDialog) heatDialog.remove(); heatDialog = null; });
    panel.appendChild(button);
    heatDialog.appendChild(panel);
    document.body.appendChild(heatDialog);
  }

  function parseOpenWeather(current, forecast) {
    var offset = Number(current.timezone || 0) * 1000;
    var currentTime = (Number(current.dt || 0) * 1000) + offset;
    var currentDate = new Date(currentTime).toISOString().slice(0, 10);
    var minimum = number(current.main && current.main.temp_min);
    var maximum = number(current.main && current.main.temp_max);
    (forecast && forecast.list || []).forEach(function (item) {
      var localDate = new Date((Number(item.dt || 0) * 1000) + offset).toISOString().slice(0, 10);
      if (localDate !== currentDate || !item.main) return;
      var low = number(item.main.temp_min); var high = number(item.main.temp_max);
      if (low != null) minimum = minimum == null ? low : Math.min(minimum, low);
      if (high != null) maximum = maximum == null ? high : Math.max(maximum, high);
    });
    var condition = current.weather && current.weather[0];
    var rain = !!(condition && Number(condition.id) >= 200 && Number(condition.id) < 600);
    return { temperature: number(current.main && current.main.temp), minimum: minimum, maximum: maximum, label: condition && condition.description ? condition.description : 'Condição atual', rain: rain, updatedAt: new Date() };
  }

  function parseOpenMeteo(data) {
    var current = data.current || {};
    var daily = data.daily || {};
    var code = Number(current.weather_code);
    var rain = Number(current.precipitation || 0) > 0 || Number(current.rain || 0) > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].indexOf(code) !== -1;
    var labels = { 0: 'Céu limpo', 1: 'Pouco nublado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Nevoeiro', 48: 'Nevoeiro', 51: 'Chuvisco', 53: 'Chuvisco', 55: 'Chuvisco', 61: 'Chuva', 63: 'Chuva', 65: 'Chuva forte', 80: 'Aguaceiros', 81: 'Aguaceiros', 82: 'Aguaceiros fortes', 95: 'Trovoada' };
    return { temperature: number(current.temperature_2m), minimum: number(daily.temperature_2m_min && daily.temperature_2m_min[0]), maximum: number(daily.temperature_2m_max && daily.temperature_2m_max[0]), label: labels[code] || 'Condição atual', rain: rain, updatedAt: new Date() };
  }

  async function fetchJson(url, timeoutMs) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs || 8000) : null;
    try {
      var response = await fetch(url, controller ? { signal: controller.signal } : undefined);
      if (!response.ok) throw new Error('Clima indisponível');
      return await response.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function readWeather(lat, lon) {
    var openWeatherUrl = 'https://api.openweathermap.org/data/2.5/weather?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&units=metric&lang=pt&appid=' + OPENWEATHER_KEY;
    var forecastUrl = 'https://api.openweathermap.org/data/2.5/forecast?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&units=metric&lang=pt&appid=' + OPENWEATHER_KEY;
    try {
      var responses = await Promise.all([fetchJson(openWeatherUrl), fetchJson(forecastUrl)]);
      return parseOpenWeather(responses[0], responses[1]);
    } catch (_) {
      var fallback = await fetchJson('https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon) + '&current=temperature_2m,precipitation,rain,weather_code&daily=temperature_2m_min,temperature_2m_max&forecast_days=1&timezone=Africa%2FMaputo', 8000);
      return parseOpenMeteo(fallback);
    }
  }

  async function refreshWeather(position) {
    try {
      var next = await readWeather(position.lat, position.lon);
      weather = Object.assign({ loading: false, scope: position.scope || 'A tua zona' }, next);
      renderCard(); setTheme(); setRain(weather.rain); showHeatWarning();
    } catch (_) {
      weather.loading = false; weather.label = 'Clima indisponível'; weather.rain = false; weather.updatedAt = null; renderCard(); setTheme(); setRain(false);
    }
  }

  function locationDenied() {
    weather = { loading: false, temperature: null, minimum: null, maximum: null, label: 'Localização necessária', rain: false, updatedAt: null, scope: 'SARCA', locationRequired: true };
    updateMapDashboardLocationLabel('Localização atual');
    renderCard(); setTheme(); setRain(false);
  }

  function requestLocation() {
    if (!navigator.geolocation) { locationDenied(); return; }
    if (!lastCurrentLocation) updateMapDashboardLocationLabel('A localizar-te…');
    navigator.geolocation.getCurrentPosition(async function (position) {
      lastCurrentLocation = {
        latitude: Number(position.coords.latitude),
        longitude: Number(position.coords.longitude),
        accuracyMeters: Number.isFinite(Number(position.coords.accuracy)) ? Number(position.coords.accuracy) : null,
        label: 'Localização atual',
      };
      rememberCurrentLocation(lastCurrentLocation);
      pickupUsesCurrentLocation = true;
      window.dispatchEvent(new CustomEvent('sarCa:current-location-ready', { detail: lastCurrentLocation }));
      startNearbyDriversPolling();
      await resolveNearestLocalPlace(lastCurrentLocation);
      commitResolvedPickupLabel(lastCurrentLocation);
      try { await publishRiderLocation(position); } catch (_) {}
      startRiderLocationPublishing();
    }, locationDenied, { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 });
  }

  function createRain() {
    rainLayer = el('div', 'sarca-rain-layer');
    rainLayer.hidden = true;
    for (var i = 0; i < 34; i++) {
      var drop = el('span', 'sarca-rain-drop');
      drop.style.left = (Math.random() * 100) + '%';
      drop.style.animationDelay = (-Math.random() * 1.4) + 's';
      drop.style.animationDuration = (0.9 + Math.random() * 0.8) + 's';
      rainLayer.appendChild(drop);
    }
    document.body.appendChild(rainLayer);
  }

  var paymentTollCard;
  var tripStateCard;
  var tripExtraCard;
  var lastTripPayload;
  var pickupReference = '';
  var dismissedCompletedTripId = '';
  var ratingEligibleTripIds = Object.create(null);
  var explicitPaymentChoice = null;
  var riderPointsSummary = { available_points: 0, reserved_points: 0, lifetime_points: 0, last_30_days_points: 0 };
  var explicitPointsChoice = 0;
  var rewardAnimationShown = {};
  var riderRewardsPollTimer = null;
  var locationShortcut;
  var locationShortcutButton;

  async function sarcaPointsRpc(name, body) {
    var authHeader = await getAuthenticatedAuthHeader();
    if (!authHeader) throw new Error('Sessão necessária');
    var response = await fetch(SARCA_SUPABASE_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'apikey': SARCA_SUPABASE_KEY,
      },
      body: JSON.stringify(body || {}),
    });
    var payload = await response.json().catch(function () { return {}; });
    if (!response.ok) throw new Error(payload.message || payload.hint || payload.error || 'Pontos SARCA indisponíveis');
    return payload;
  }

  async function refreshRiderPoints() {
    try {
      var summary = await sarcaPointsRpc('get_my_points_summary_v2', { p_request: {} });
      riderPointsSummary = Array.isArray(summary) ? (summary[0] || riderPointsSummary) : (summary || riderPointsSummary);
      // Keep the confirmation card stable while points are polled. Rebuilding
      // the whole card made it disappear/reappear and could steal input focus.
      if (paymentTollCard && paymentTollCard.classList.contains('is-visible')) {
        var balance = paymentTollCard.querySelector('[data-sarca-points-balance]');
        var availablePoints = Math.max(0, Number(riderPointsSummary.available_points || 0));
        if (balance) balance.textContent = 'Saldo: ' + availablePoints + ' pontos · 100 pontos = 1% (máx. 5%)';
      }
    } catch (_) {}
  }

  function installPointsRewardStyles() {
    if (document.getElementById('sarCa-points-style')) return;
    var style = document.createElement('style');
    style.id = 'sarCa-points-style';
    style.textContent = '@keyframes sarcaRewardPop{0%{opacity:0;transform:translate(-50%,-42%) scale(.82)}60%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}' +
      '.sarCa-reward-animation{letter-spacing:.1px}.sarca-points-choice{border:1px solid rgba(255,255,255,.16);border-radius:14px;padding:10px 12px;margin:8px 0;background:rgba(9,25,48,.58);color:#fff}' +
      '.sarca-points-choice button{min-width:52px;margin:4px;border:1px solid rgba(255,255,255,.22);border-radius:10px;background:rgba(255,255,255,.08);color:#fff;padding:8px 10px;font-weight:700}' +
      '.sarca-points-choice button.is-selected{background:#0b5cff;color:#fff;border-color:#0b5cff;box-shadow:0 3px 10px rgba(11,92,255,.22)}';
    document.head.appendChild(style);
  }

  function showRewardAnimation(points) {
    if (!points || points <= 0) return;
    var overlay = document.createElement('div');
    overlay.className = 'sarCa-reward-animation';
    overlay.textContent = '+' + String(points) + ' pontos SARCA';
    overlay.style.cssText = 'position:fixed;z-index:99999;left:50%;top:28%;transform:translate(-50%,-50%);padding:18px 24px;border-radius:18px;background:linear-gradient(135deg,#0b5cff,#21c7a8);color:#fff;font-weight:800;font-size:18px;box-shadow:0 18px 50px #001a4d55;animation:sarcaRewardPop .35s ease-out both;pointer-events:none;';
    document.body.appendChild(overlay);
    window.setTimeout(function () { overlay.remove(); }, 3200);
  }

  async function refreshRiderRewards() {
    try {
      var events = await sarcaPointsRpc('list_my_reward_events', { p_limit: 10 });
      if (!Array.isArray(events)) return;
      for (var index = events.length - 1; index >= 0; index -= 1) {
        var event = events[index];
        if (!event || Number(event.points_awarded || 0) <= 0 || rewardAnimationShown[event.id]) continue;
        var eventStatus = String(event.status || '').toLowerCase();
        var eventCreatedAt = Date.parse(String(event.created_at || event.createdAt || ''));
        var recentlyPresented = eventStatus === 'presented' && isFinite(eventCreatedAt) &&
          Math.abs(Date.now() - eventCreatedAt) < 120000;
        if (eventStatus !== 'available' && !recentlyPresented) continue;
        rewardAnimationShown[event.id] = true;
        if (recentlyPresented) {
          showRewardAnimation(Number(event.points_awarded || 0));
          continue;
        }
        try {
          var claimed = await sarcaPointsRpc('claim_reward_animation', { p_event_id: event.id });
          var result = Array.isArray(claimed) ? (claimed[0] || claimed) : claimed;
          if (result && result.already_presented) continue;
          showRewardAnimation(Number(event.points_awarded || 0));
        } catch (_) {
          delete rewardAnimationShown[event.id];
        }
      }
      refreshRiderPoints();
    } catch (_) {}
  }

  function startRiderRewardsPolling() {
    if (riderRewardsPollTimer) return;
    riderRewardsPollTimer = window.setInterval(function () {
      if (document.visibilityState === 'visible') refreshRiderRewards();
    }, 4000);
  }

  function showLocationShortcutState(label, state) {
    var button = mapDashboardLocationButton || locationShortcutButton;
    if (!button) return;
    button.disabled = state === 'loading';
    button.classList.toggle('is-success', state === 'success');
    button.classList.toggle('is-error', state === 'error');
    if (button === mapDashboardLocationButton) {
      button.textContent = state === 'loading' ? '…' : state === 'success' ? '✓' : state === 'error' ? '!' : '⌖';
      button.title = state === 'loading' ? 'A obter localização…' : state === 'success' ? 'Origem preenchida' : state === 'error' ? label : 'Usar localização atual';
      button.setAttribute('aria-label', button.title);
      return;
    }
    button.textContent = label;
  }

  function renderCurrentLocationStatus(label, state) {
    var status = document.getElementById('sarca-current-location-status');
    if (!status) {
      status = el('div', 'sarca-current-location-status');
      status.id = 'sarca-current-location-status';
      document.body.appendChild(status);
    }
    if (state === 'success' && String(label || '').indexOf('📍') === 0) {
      status.textContent = '';
      status.classList.remove('is-visible', 'is-pending');
      return;
    }
    status.textContent = label;
    status.classList.toggle('is-visible', !!label);
    status.classList.toggle('is-pending', state === 'pending');
  }

  function fillFlutterPickupField(label) {
    try {
      var inputs = Array.prototype.slice.call(document.querySelectorAll('flt-semantics input[data-semantics-role="text-field"]'));
      var input = inputs.find(function (candidate) {
        var aria = String(candidate.getAttribute('aria-label') || '').toLowerCase();
        var description = String(candidate.getAttribute('data-semantics-label') || '').toLowerCase();
        return /localiza[cç][aã]o|origem|de onde/.test(aria + ' ' + description);
      });
      if (!input) {
        input = inputs.find(function (candidate) {
          var rect = candidate.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      }
      if (!input) return false;
      var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, label);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }

  function setFlutterTextField(input, value) {
    if (!input) return false;
    try {
      var setter = Object.getOwnPropertyDescriptor(input.ownerDocument.defaultView.HTMLInputElement.prototype, 'value').set;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }

  function getFlutterDestinationInput() {
    var semanticInputs = Array.prototype.slice.call(document.querySelectorAll('flt-semantics input[data-semantics-role="text-field"]'));
    var allInputs = Array.prototype.slice.call(document.querySelectorAll('input'));
    var inputs = semanticInputs.concat(allInputs.filter(function (candidate) {
      return semanticInputs.indexOf(candidate) === -1;
    }));
    return inputs.find(function (candidate) {
      var rect = candidate.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      var labels = [
        candidate.getAttribute('aria-label'),
        candidate.getAttribute('placeholder'),
        candidate.getAttribute('data-semantics-label'),
        candidate.getAttribute('name'),
      ].filter(Boolean).join(' ').trim().toLowerCase();
      return /para onde|destino|drop.?off|entrega/.test(labels) && !/de onde|origem|pickup|recolha/.test(labels);
    }) || null;
  }

  function getDestinationInputCandidates() {
    var candidates = [];
    if (mapDashboardDestinationInput) candidates.push(mapDashboardDestinationInput);
    var flutterInput = getFlutterDestinationInput();
    if (flutterInput && candidates.indexOf(flutterInput) === -1) candidates.push(flutterInput);
    return candidates;
  }

  function getDestinationInput() {
    return mapDashboardDestinationInput || getFlutterDestinationInput();
  }

  function clearDestinationSuggestions() {
    var existing = document.getElementById('sarca-destination-suggestions');
    if (existing) existing.remove();
    if (mapDashboardPanel) mapDashboardPanel.classList.remove('has-suggestions');
  }

  function appendDestinationSuggestionPanel(panel, input, isDashboardInput) {
    if (!panel) return;
    if (isDashboardInput && mapDashboardPanel) {
      var home = mapDashboardPanel.querySelector('.sarCa-map-dashboard-home');
      if (home) {
        mapDashboardPanel.classList.add('has-suggestions');
        home.appendChild(panel);
      } else {
        document.body.appendChild(panel);
      }
    } else {
      document.body.appendChild(panel);
    }
  }

  function localPlaceLabel(place) {
    var rawName = String(place && (place.name || place.display_name || place.title) || '').trim();
    var title = rawName || formatNearestPlaceLabel(place);
    var categoryLabels = {
      avenue: 'Avenida',
      street: 'Rua',
      road: 'Rua',
      via: 'Via',
      neighbourhood: 'Bairro',
      neighborhood: 'Bairro',
      suburb: 'Bairro',
      quarter: 'Bairro',
      zone: 'Zona',
      bus_stop: 'Paragem',
      station: 'Estação',
      office: 'Escritório',
      shop: 'Estabelecimento',
      restaurant: 'Restaurante',
      pharmacy: 'Farmácia',
      place: 'Localidade',
      locality: 'Localidade',
      village: 'Vila',
      town: 'Cidade',
      city: 'Cidade'
    };
    var category = normalizePlaceSearchText(place && place.category || '');
    var categoryLabel = categoryLabels[category] || '';
    var referenceKeys = [
      'address', 'full_address', 'subtitle',
      'street', 'street_name', 'road', 'road_name', 'avenue', 'avenida',
      'neighborhood', 'neighborhood_name', 'bairro', 'bairro_name', 'zone',
      'zone_name', 'locality', 'district', 'town', 'village', 'city', 'province'
    ];
    var references = [];
    referenceKeys.forEach(function (key) {
      var value = String(place && place[key] || '').trim();
      if (!value || value.toLowerCase() === title.toLowerCase()) return;
      if (!references.some(function (existing) { return existing.toLowerCase() === value.toLowerCase(); })) references.push(value);
    });
    if (categoryLabel && !references.some(function (existing) {
      return normalizePlaceSearchText(existing) === normalizePlaceSearchText(categoryLabel);
    })) references.unshift(categoryLabel);
    return {
      title: title,
      reference: references.slice(0, 3).join(' · '),
      country: String(place && (place.country || place.country_name) || 'Moçambique').trim()
    };
  }

  function localPlaceSecondaryLabel(info) {
    var reference = String(info && info.reference || '').trim();
    var country = String(info && info.country || 'Moçambique').trim();
    // Always show the most useful local context first. The country is only a
    // final confirmation, never the only context shown for a named result.
    return [reference, country].filter(Boolean).join(' · ') || 'Moçambique';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function renderDestinationSuggestions(input, places, query, state) {
    var restoreFocus = document.activeElement === input;
    var selectionStart = restoreFocus ? input.selectionStart : null;
    var selectionEnd = restoreFocus ? input.selectionEnd : null;
    var keepDestinationFocus = function () {
      if (!restoreFocus || !input || !input.isConnected) return;
      window.requestAnimationFrame(function () {
        if (!input.isConnected) return;
        if (document.activeElement !== input) input.focus({ preventScroll: true });
        try {
          if (selectionStart != null && selectionEnd != null) {
            input.setSelectionRange(selectionStart, selectionEnd);
          }
        } catch (_) {}
      });
    };
    clearDestinationSuggestions();
    if (!input || !document.body) return;
    if (input.__sarCaSelectedValue && input.value === input.__sarCaSelectedValue) return;
    var rect = input.getBoundingClientRect();
    var isDashboardInput = input === mapDashboardPickupInput || input === mapDashboardDestinationInput;
    var panel = el('div', 'sarca-destination-suggestions');
    panel.id = 'sarca-destination-suggestions';
    panel.style.position = isDashboardInput ? 'relative' : 'fixed';
    panel.style.left = isDashboardInput ? 'auto' : Math.max(12, rect.left) + 'px';
    panel.style.top = isDashboardInput ? 'auto' : (rect.bottom + 8) + 'px';
    panel.style.width = isDashboardInput ? '100%' : Math.min(rect.width, window.innerWidth - 24) + 'px';
    panel.style.zIndex = isDashboardInput ? '70' : '60';
    panel.style.boxSizing = 'border-box';
    panel.style.padding = '6px';
    panel.style.borderRadius = '14px';
    panel.style.background = 'rgba(8,20,34,.96)';
    panel.style.boxShadow = '0 10px 28px rgba(0,0,0,.24)';
    panel.style.backdropFilter = 'blur(10px)';
    panel.style.webkitBackdropFilter = 'blur(10px)';
    panel.style.maxHeight = isDashboardInput ? '148px' : '184px';
    panel.style.overflowY = 'auto';
    panel.style.marginTop = isDashboardInput ? '6px' : '0';
    if (!isDashboardInput) {
      var maxBottom = window.innerHeight - 78;
      var preferredHeight = Math.min(184, Math.max(96, places.length * 52 + 12));
      if (rect.bottom + 8 + preferredHeight > maxBottom) {
        panel.style.top = Math.max(12, rect.top - preferredHeight - 8) + 'px';
      }
    }
    if (!places.length) {
      var status = state === 'loading'
        ? 'A pesquisar locais em Moçambique…'
        : state === 'error'
          ? 'Não foi possível pesquisar agora. Verifica a ligação e tenta novamente.'
          : String(query || '').trim().length < 3
            ? 'Continua a escrever para ver sugestões…'
          : 'Não encontramos “' + String(query || '').trim() + '”. Tenta outra forma do nome ou escolhe um local do mapa.';
      panel.style.padding = '13px 14px';
      panel.style.color = 'rgba(255,255,255,.78)';
      panel.innerHTML = '<div style="font:700 12px/1.35 system-ui,sans-serif">' + escapeHtml(status) + '</div>' +
        (state === 'loading' ? '<div style="margin-top:5px;color:rgba(255,255,255,.56);font:500 11px/1.3 system-ui,sans-serif">A consultar a base local e o mapa.</div>' : '') +
        (state === 'no-results' ? '<div style="margin-top:5px;color:rgba(255,255,255,.56);font:500 11px/1.3 system-ui,sans-serif">Podes continuar a escrever para refinar a pesquisa.</div>' : '');
      appendDestinationSuggestionPanel(panel, input, isDashboardInput);
      keepDestinationFocus();
      return;
    }
    places.slice(0, 6).forEach(function (place) {
      var info = localPlaceLabel(place);
      if (!info.title) return;
      var secondary = localPlaceSecondaryLabel(info);
      var button = el('button', 'sarca-destination-suggestion');
      button.type = 'button';
      button.style.display = 'block';
      button.style.width = '100%';
      button.style.padding = '11px 12px';
      button.style.border = '0';
      button.style.borderBottom = '1px solid rgba(255,255,255,.09)';
      button.style.background = 'transparent';
      button.style.color = '#fff';
      button.style.textAlign = 'left';
      button.style.cursor = 'pointer';
      button.innerHTML = '<strong style="display:block;font:700 13px/1.25 system-ui,sans-serif">' + escapeHtml(info.title) + '</strong>' +
        '<span style="display:block;margin-top:3px;color:rgba(255,255,255,.68);font:500 11px/1.25 system-ui,sans-serif">' +
        escapeHtml(secondary) + '</span>';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        var selectedLabel = info.title;
        if (info.reference && normalizePlaceSearchText(info.reference).indexOf(normalizePlaceSearchText(info.title)) === -1) {
          selectedLabel += ' · ' + info.reference;
        }
        var selected = {
          label: selectedLabel,
          latitude: Number(place.latitude),
          longitude: Number(place.longitude),
          placeId: place.id || null,
        };
        lastDestinationSelection = selected;
        destinationSearchRequestId++;
        input.__sarCaSelectedValue = selected.label;
        if (input === mapDashboardDestinationInput) input.value = selected.label;
        else setFlutterTextField(input, selected.label);
        var flutterDestinationInput = getFlutterDestinationInput();
        if (flutterDestinationInput && flutterDestinationInput !== input) setFlutterTextField(flutterDestinationInput, selected.label);
        clearDestinationSuggestions();
        syncFullMapSurface();
        window.dispatchEvent(new CustomEvent('sarCa:destination-selected', { detail: selected }));
        prepareDestinationRoute(selected);
      });
      panel.appendChild(button);
    });
    if (!panel.children.length) return;
    appendDestinationSuggestionPanel(panel, input, isDashboardInput);
    keepDestinationFocus();
  }

  function normalizePlaceSearchText(value) {
    var text = String(value || '').trim().toLocaleLowerCase();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (_) {}
    return text.replace(/\s+/g, ' ').trim();
  }

  function loadLocalPriorityPlaces() {
    if (localPriorityPlacesPromise) return localPriorityPlacesPromise;
    localPriorityPlacesPromise = fetch('assets/packages/deligo_app_core/assets/data/mozambique_priority_places.json?v=20261105-destination-fix-kampfumo', { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : []; })
      .then(function (places) {
        localPriorityPlaces = Array.isArray(places) ? places : [];
        return localPriorityPlaces;
      })
      .catch(function () {
        localPriorityPlaces = [];
        return [];
      });
    return localPriorityPlacesPromise;
  }

  function fetchLocalPriorityPlaceResults(query) {
    var normalizedQuery = normalizePlaceSearchText(query);
    var tokens = normalizedQuery.split(/\s+/).filter(function (token) {
      return token.length >= 2 && !['para', 'onde', 'fica', 'avenida', 'av', 'rua', 'bairro', 'zona'].includes(token);
    });
    return loadLocalPriorityPlaces().then(function (places) {
      return places.map(function (place) {
        var aliases = Array.isArray(place.aliases) ? place.aliases : [];
        var haystack = normalizePlaceSearchText([place.title, place.subtitle].concat(aliases).join(' '));
        var matches = normalizedQuery && haystack.indexOf(normalizedQuery) >= 0;
        if (!matches && tokens.length) matches = tokens.every(function (token) { return haystack.indexOf(token) >= 0; });
        if (!matches) return null;
        var karrimbo = /karrimbo/i.test(normalizedQuery) && /karrimbo/i.test(String(place.subtitle || ''));
        var displayName = karrimbo ? 'Mercado Karrimbo' : String(place.title || '').trim();
        return {
          id: place.id,
          name: displayName,
          display_name: displayName + (place.subtitle ? ' · ' + place.subtitle : ''),
          subtitle: place.subtitle || '',
          category: 'localidade',
          city: 'Moçambique',
          locality: place.subtitle || '',
          aliases: aliases,
          latitude: Number(place.latitude),
          longitude: Number(place.longitude),
          source: 'sarca-curated',
        };
      }).filter(function (place) {
        return place && isFinite(place.latitude) && isFinite(place.longitude);
      });
    });
  }

  function fetchMapPlaceResults(query, signal) {
    return fetch(SARCA_SUPABASE_URL + '/rest/v1/rpc/search_map_places', {
      method: 'POST',
      signal: signal,
      headers: {
        apikey: SARCA_SUPABASE_KEY,
        Authorization: 'Bearer ' + SARCA_SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_query: query,
        p_latitude: lastCurrentLocation ? lastCurrentLocation.latitude : null,
        p_longitude: lastCurrentLocation ? lastCurrentLocation.longitude : null,
        p_limit: 20,
      }),
    }).then(function (response) {
      return response.ok ? response.json() : [];
    });
  }

  function fetchMapboxPlaceResults(query, signal) {
    var params = new URLSearchParams({
      q: String(query || ''),
      access_token: SARCA_MAPBOX_TOKEN,
      country: 'MZ',
      language: 'pt',
      autocomplete: 'true',
      limit: '8',
    });
    if (lastCurrentLocation && isFinite(Number(lastCurrentLocation.longitude)) && isFinite(Number(lastCurrentLocation.latitude))) {
      params.set('proximity', String(lastCurrentLocation.longitude) + ',' + String(lastCurrentLocation.latitude));
    }
    return fetch('https://api.mapbox.com/search/geocode/v6/forward?' + params.toString(), { signal: signal }).then(function (response) {
      return response.ok ? response.json() : {};
    }).then(function (payload) {
      var features = payload && Array.isArray(payload.features) ? payload.features : [];
      return features.map(function (feature) {
        var properties = feature && feature.properties || {};
        var geometry = feature && feature.geometry || {};
        var coordinates = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
        var context = properties.context && typeof properties.context === 'object' ? properties.context : {};
        function contextValue(keys) {
          for (var i = 0; i < keys.length; i += 1) {
            var item = context[keys[i]];
            if (item && (item.name || item.text)) return String(item.name || item.text);
          }
          return '';
        }
        var name = String(properties.name || properties.full_address || feature.text || feature.place_name || '').trim();
        return {
          id: 'mapbox:' + String(feature.id || name),
          name: name,
          display_name: String(properties.full_address || feature.place_name || name),
          category: String(properties.feature_type || feature.place_type && feature.place_type[0] || 'localidade'),
          street: contextValue(['street']),
          avenue: contextValue(['street']),
          neighborhood: contextValue(['neighborhood']),
          bairro: contextValue(['neighborhood']),
          district: contextValue(['district']),
          locality: contextValue(['locality']),
          town: contextValue(['place']),
          city: contextValue(['place']),
          province: contextValue(['region']),
          country: contextValue(['country']) || 'Moçambique',
          latitude: Number(coordinates[1]),
          longitude: Number(coordinates[0]),
        };
      }).filter(function (place) {
        return place.name && isFinite(place.latitude) && isFinite(place.longitude);
      });
    });
  }

  function rankPlaceSearchResults(groups, normalizedQuery) {
    var merged = Object.create(null);
    function placeNameKey(place) {
      return normalizePlaceSearchText(place && (place.name || place.display_name || place.title) || '');
    }
    function mergePlaceDetails(target, source) {
      Object.keys(source || {}).forEach(function (key) {
        var value = source[key];
        var current = target[key];
        var currentEmpty = current == null || current === '' || (Array.isArray(current) && !current.length);
        var valuePresent = value != null && value !== '' && (!Array.isArray(value) || value.length);
        if (currentEmpty && valuePresent) target[key] = value;
      });
      if (Array.isArray(source && source.aliases)) {
        target.aliases = Array.from(new Set([].concat(target.aliases || [], source.aliases)));
      }
      return target;
    }
    groups.forEach(function (places) {
      (Array.isArray(places) ? places : []).forEach(function (place) {
        var nameKey = placeNameKey(place);
        var latitude = Number(place && place.latitude);
        var longitude = Number(place && place.longitude);
        if (!nameKey) return;
        var matchingKey = Object.keys(merged).find(function (key) {
          var existing = merged[key];
          if (placeNameKey(existing) !== nameKey) return false;
          var distance = distanceKmBetween(latitude, longitude, Number(existing.latitude), Number(existing.longitude));
          return distance <= 0.5;
        });
        if (matchingKey) {
          mergePlaceDetails(merged[matchingKey], place);
          return;
        }
        var key = String(place && (place.id || nameKey + ':' + latitude + ':' + longitude) || '');
        if (!key) return;
        merged[key] = Object.assign({}, place);
      });
    });
    var tokens = normalizedQuery.split(/\s+/).filter(function (token) {
      return token.length >= 3 && !['para', 'onde', 'fica', 'com', 'das', 'dos', 'de'].includes(token);
    });
    return Object.keys(merged).map(function (key) { return merged[key]; }).sort(function (left, right) {
      function score(place) {
        var name = normalizePlaceSearchText(place && place.name);
        var category = normalizePlaceSearchText(place && place.category);
        var aliases = normalizePlaceSearchText(place && Array.isArray(place.aliases) ? place.aliases.join(' ') : '');
        var displayName = normalizePlaceSearchText(place && (place.display_name || place.subtitle));
        var searchable = [name, aliases, displayName].filter(Boolean).join(' ');
        var value = 0;
        tokens.forEach(function (token, index) {
          if (name.indexOf(token) >= 0) value += index === 0 ? 100 : 25;
          if (aliases.indexOf(token) >= 0) value += index === 0 ? 120 : 35;
          if (displayName.indexOf(token) >= 0) value += 15;
          if (category.indexOf(token) >= 0) value += 5;
        });
        if (place && place.source === 'sarca-curated') {
          value += 8;
          if (tokens.length && tokens.every(function (token) { return searchable.indexOf(token) >= 0; })) value += 220;
        }
        return value;
      }
      return score(right) - score(left);
    });
  }

  function searchDestinationPlaces(input) {
    var query = String(input && input.value || '').trim();
    if (input && input.__sarCaSelectedValue && query === input.__sarCaSelectedValue) {
      clearDestinationSuggestions();
      return;
    }
    // Query immediately, including the first character, so the passenger
    // never has to erase the last word to make suggestions appear.
    if (query.length < 1) {
      if (destinationSearchTimer) clearTimeout(destinationSearchTimer);
      if (destinationSearchAbortController) destinationSearchAbortController.abort();
      clearDestinationSuggestions();
      return;
    }
    var normalizedQuery = normalizePlaceSearchText(query);
    var cacheKey = normalizedQuery;
    if (destinationSearchCache[cacheKey]) renderDestinationSuggestions(input, destinationSearchCache[cacheKey], query, destinationSearchCache[cacheKey].length ? 'results' : 'no-results');
    else renderDestinationSuggestions(input, [], query, 'loading');
    if (destinationSearchTimer) clearTimeout(destinationSearchTimer);
    if (destinationSearchAbortController) destinationSearchAbortController.abort();
    destinationSearchTimer = setTimeout(function () {
      var requestId = ++destinationSearchRequestId;
      destinationSearchAbortController = typeof AbortController === 'function' ? new AbortController() : null;
      var searchQueries = [query];
      if (normalizedQuery && normalizedQuery !== query) searchQueries.push(normalizedQuery);
      var searchTokens = normalizedQuery.split(/\s+/).filter(function (token) {
        return token.length >= 1 && !['a', 'as', 'ao', 'aos', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'na', 'nas', 'no', 'nos', 'para', 'por', 'um', 'uma', 'onde', 'fica', 'com'].includes(token);
      });
      var searchAliases = {
        parragens: ['paragens', 'paragem'],
        paradas: ['paragens', 'paragem'],
        mercados: ['mercado'],
        hoteis: ['hotel'],
        farmacias: ['farmacia', 'farmácia'],
        restaurantes: ['restaurante'],
        supermercados: ['supermercado'],
      };
      searchTokens.forEach(function (token) {
        searchQueries.push(token);
        (searchAliases[token] || []).forEach(function (alias) { searchQueries.push(alias); });
      });
      searchQueries = searchQueries.filter(function (value, index, values) {
        return value && values.indexOf(value) === index;
      }).slice(0, 6);
      var signal = destinationSearchAbortController ? destinationSearchAbortController.signal : undefined;
      // Search the complete phrase and each meaningful partial term. A place
      // such as "Mercado Karrimbo" must remain discoverable while the user is
      // still typing the final word, even when the full phrase is not an exact
      // row in the remote catalogue.
      var localRequest = Promise.all(searchQueries.map(function (searchQuery) {
        return fetchLocalPriorityPlaceResults(searchQuery).catch(function () { return []; });
      })).then(function (groups) {
        var places = rankPlaceSearchResults(groups, normalizedQuery);
        if (requestId === destinationSearchRequestId && getDestinationInput() === input && places.length) {
          renderDestinationSuggestions(input, places, query, 'results');
        }
        return { places: places, failed: false };
      }).catch(function () { return { places: [], failed: true }; });
      var searchRequests = searchQueries.map(function (searchQuery) {
        return fetchMapPlaceResults(searchQuery, signal).then(function (places) {
          return { places: Array.isArray(places) ? places : [], failed: false };
        }).catch(function (error) {
          if (error && error.name === 'AbortError') throw error;
          return { places: [], failed: true };
        });
      });
      searchRequests.push(localRequest);
      searchRequests.push(fetchMapboxPlaceResults(query, signal).then(function (places) {
        return { places: Array.isArray(places) ? places : [], failed: false };
      }).catch(function (error) {
        if (error && error.name === 'AbortError') throw error;
        return { places: [], failed: true };
      }));
      Promise.all(searchRequests).then(function (responses) {
        if (requestId !== destinationSearchRequestId || getDestinationInput() !== input) return;
        var groups = responses.map(function (response) { return response.places; });
        var results = rankPlaceSearchResults(groups, normalizedQuery);
        destinationSearchCache[cacheKey] = results;
        var failedCount = responses.filter(function (response) { return response.failed; }).length;
        renderDestinationSuggestions(input, results, query, !results.length && failedCount === responses.length ? 'error' : results.length ? 'results' : 'no-results');
      }).catch(function (error) {
        if (error && error.name === 'AbortError') return;
        if (requestId === destinationSearchRequestId) renderDestinationSuggestions(input, [], query, 'error');
      });
    }, 90);
  }

  function formatRouteMinutes(seconds) {
    var minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
    return minutes + ' min';
  }

  function sharedRoadHint(originLabel, destinationLabel) {
    var origin = normalizePlaceSearchText(originLabel || '');
    var destination = normalizePlaceSearchText(destinationLabel || '');
    var knownRoads = [
      { search: '25 de setembro', label: '25 de Setembro' },
    ];
    for (var index = 0; index < knownRoads.length; index += 1) {
      var road = knownRoads[index];
      if (origin.indexOf(road.search) !== -1 && destination.indexOf(road.search) !== -1) return road.label;
    }
    return '';
  }

  function routeStatusLabel(origin, destination, distanceKm, durationSeconds) {
    return '🛣️ ' + Number(distanceKm || 0).toFixed(1) + ' km · ' + formatRouteMinutes(durationSeconds);
  }

  async function prepareDestinationRoute(selection) {
    if (!selection || !lastCurrentLocation) return;
    renderCurrentLocationStatus('🛣️ A preparar a rota para ' + selection.label + '…', 'pending');
    try {
      var coordinates = [
        lastCurrentLocation.longitude + ',' + lastCurrentLocation.latitude,
        selection.longitude + ',' + selection.latitude,
      ].join(';');
      var response = await fetch('https://api.mapbox.com/directions/v5/mapbox/driving/' + coordinates +
        '?alternatives=false&geometries=geojson&overview=full&steps=false&access_token=' + encodeURIComponent(SARCA_MAPBOX_TOKEN));
      if (!response.ok) throw new Error('route');
      var payload = await response.json();
      var route = Array.isArray(payload.routes) ? payload.routes[0] : null;
      if (!route) throw new Error('route');
      var geometry = route.geometry && Array.isArray(route.geometry.coordinates) ? route.geometry.coordinates : [];
      selection.distanceKm = Number(route.distance || 0) / 1000;
      selection.durationSeconds = Number(route.duration || 0);
      selection.routePoints = geometry.filter(function (point) { return Array.isArray(point) && point.length >= 2; }).map(function (point) {
        return { latitude: Number(point[1]), longitude: Number(point[0]) };
      });
      syncFullMapSurface();
      renderCurrentLocationStatus(routeStatusLabel(lastCurrentLocation, selection, selection.distanceKm, selection.durationSeconds), 'success');
      showMapDashboardRouteAction();
      window.dispatchEvent(new CustomEvent('sarCa:route-ready', { detail: {
        pickup: lastCurrentLocation,
        destination: selection,
        distanceKm: selection.distanceKm,
        durationSeconds: selection.durationSeconds,
        routePoints: selection.routePoints,
      } }));
      loadMapDashboardCategoryPrices();
    } catch (_) {
      renderCurrentLocationStatus('📍 ' + (lastCurrentLocation.label || 'Localização atual') + ' · não foi possível calcular a rota', 'error');
    }
  }

  function installDestinationSearch() {
    var scan = function () {
      if (lastCurrentLocation && lastCurrentLocation.label) fillFlutterPickupField(lastCurrentLocation.label);
      getDestinationInputCandidates().forEach(function (input) {
        if (!input || input.__sarCaDestinationSearch) return;
        input.__sarCaDestinationSearch = true;
        var lastObservedValue = null;
        var searchFromInput = function () {
          var currentValue = String(input.value || '');
          if (currentValue === lastObservedValue) return;
          lastObservedValue = currentValue;
          if (input.__sarCaSelectedValue && input.value === input.__sarCaSelectedValue) {
            clearDestinationSuggestions();
            return;
          }
          input.__sarCaSelectedValue = '';
          resetDestinationSelectionForEditing();
          searchDestinationPlaces(input);
        };
        // `input` is the normal path. `keyup` and `compositionend` cover
        // Android WebView/IME implementations that do not forward the first
        // committed character as a DOM input event.
        input.addEventListener('input', searchFromInput);
        // Some Android IMEs emit keyup after input. Keep the fallback, but
        // deduplicate it so the first character cannot rebuild the panel and
        // steal focus from the destination field.
        input.addEventListener('keyup', searchFromInput);
        input.addEventListener('compositionend', searchFromInput);
        input.addEventListener('focus', function () {
          if (input.value) {
            lastObservedValue = String(input.value || '');
            searchDestinationPlaces(input);
          }
        });
        input.addEventListener('blur', function () {
          // The dashboard input remains usable while the mobile keyboard or
          // a suggestion panel temporarily changes the active element.
          if (input !== mapDashboardDestinationInput) {
            setTimeout(function () {
              if (document.activeElement !== input &&
                  !document.activeElement?.closest?.('#sarca-destination-suggestions')) {
                clearDestinationSuggestions();
              }
            }, 350);
          }
        });
      });
    };
    scan();
    if (!window.__sarCaDestinationSearchObserver) {
      window.__sarCaDestinationSearchObserver = new MutationObserver(scan);
      window.__sarCaDestinationSearchObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label'] });
    }
    setTimeout(scan, 250);
    setTimeout(scan, 900);
    setTimeout(scan, 1800);
  }

  function formatNearestPlaceLabel(place) {
    if (!place || !place.name) return '';
    var parts = [String(place.name).trim()];
    var locality = String(place.district || place.city || '').trim();
    if (locality && locality.toLowerCase() !== parts[0].toLowerCase()) parts.push(locality);
    return parts.filter(Boolean).join(', ');
  }

  async function reverseMapboxLocationLabel(location) {
    if (!location || !isFinite(Number(location.latitude)) || !isFinite(Number(location.longitude))) return '';
    var longitude = Number(location.longitude);
    var latitude = Number(location.latitude);
    var featureLabel = function (feature) {
      if (!feature) return '';
      var properties = feature.properties || {};
      var context = feature.context || {};
      var fullAddress = String(properties.full_address || feature.place_name || '').trim();
      if (fullAddress) return fullAddress;
      var name = String(properties.name || feature.text || '').trim();
      var address = String(properties.address || feature.address || '').trim();
      var locality = String(
        (context.locality && context.locality[0] && (context.locality[0].text || context.locality[0].name)) ||
        (context.place && context.place[0] && (context.place[0].text || context.place[0].name)) ||
        (context.district && context.district[0] && (context.district[0].text || context.district[0].name)) ||
        '',
      ).trim();
      return [name, address, locality].filter(Boolean).filter(function (value, index, values) {
        return values.indexOf(value) === index;
      }).join(', ');
    };
    try {
      var params = new URLSearchParams({
        longitude: String(longitude),
        latitude: String(latitude),
        access_token: SARCA_MAPBOX_TOKEN,
        language: 'pt',
        limit: '1',
      });
      var payload = await fetchJson('https://api.mapbox.com/search/geocode/v6/reverse?' + params.toString(), 5000);
      var feature = payload && Array.isArray(payload.features) ? payload.features[0] : null;
      var label = featureLabel(feature);
      if (label) return label;
    } catch (_) {
      // Try the legacy endpoint below; some Mapbox accounts still return the
      // most complete street/neighborhood context through v5.
    }
    try {
      var legacyUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(longitude + ',' + latitude) + '.json?types=address,poi,neighborhood,locality,place&language=pt&limit=1&access_token=' + encodeURIComponent(SARCA_MAPBOX_TOKEN);
      var legacyPayload = await fetchJson(legacyUrl, 5000);
      var legacyFeature = legacyPayload && Array.isArray(legacyPayload.features) ? legacyPayload.features[0] : null;
      return featureLabel(legacyFeature);
    } catch (_) {
      return '';
    }
  }

  function distanceKmBetween(latitudeA, longitudeA, latitudeB, longitudeB) {
    var values = [latitudeA, longitudeA, latitudeB, longitudeB].map(Number);
    if (values.some(function (value) { return !isFinite(value); })) return Infinity;
    var radians = Math.PI / 180;
    var dLatitude = (values[2] - values[0]) * radians;
    var dLongitude = (values[3] - values[1]) * radians;
    var a = Math.sin(dLatitude / 2) * Math.sin(dLatitude / 2) +
      Math.cos(values[0] * radians) * Math.cos(values[2] * radians) *
      Math.sin(dLongitude / 2) * Math.sin(dLongitude / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  async function resolveNearestLocalPlace(location) {
    if (!location || !isFinite(location.latitude) || !isFinite(location.longitude)) return location;
    var nearestLabel = '';
    try {
      var controller = typeof AbortController === 'function' ? new AbortController() : null;
      var timer = controller ? setTimeout(function () { controller.abort(); }, 4500) : null;
      var response = await fetch(SARCA_SUPABASE_URL + '/rest/v1/rpc/nearest_map_place', {
        method: 'POST',
        headers: {
          apikey: SARCA_SUPABASE_KEY,
          Authorization: 'Bearer ' + SARCA_SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          p_latitude: location.latitude,
          p_longitude: location.longitude,
          p_limit: 1,
        }),
      });
      if (response.ok) {
        var places = await response.json();
        var nearest = Array.isArray(places) ? places[0] : places;
        var nearestDistance = nearest && distanceKmBetween(
          location.latitude,
          location.longitude,
          nearest.latitude,
          nearest.longitude,
        );
        nearestLabel = nearestDistance <= 0.5 ? formatNearestPlaceLabel(nearest) : '';
      }
      if (timer) clearTimeout(timer);
    } catch (_) {}
    var reverseLabel = await reverseMapboxLocationLabel(location);
    // Prefer the national SARCA places index when it has a nearby named
    // street, neighborhood, avenue or establishment; Mapbox is the fallback.
    var label = nearestLabel || reverseLabel;
    if (label) {
      location.label = label;
      location.placeName = label;
      rememberCurrentLocation(location);
      renderCurrentLocationStatus('📍 ' + label, 'success');
      fillFlutterPickupField(label);
      [120, 500, 1000, 1800].forEach(function (delay) {
        setTimeout(function () { fillFlutterPickupField(label); }, delay);
      });
    }
    return location;
  }

  function commitResolvedPickupLabel(location) {
    var label = String(location && location.label || '').trim() || 'Localização atual';
    if (location && label !== 'Localização atual') {
      location.placeName = label;
      rememberCurrentLocation(location);
    }
    // Flutter may create the semantics input a few frames after the GPS
    // callback. Retry the authoritative street/place label until the pickup
    // card is ready, instead of leaving the temporary placeholder visible.
    fillFlutterPickupField(label);
    updateMapDashboardLocationLabel(label);
    [100, 300, 700, 1200, 2000].forEach(function (delay) {
      setTimeout(function () { fillFlutterPickupField(label); }, delay);
    });
    renderCurrentLocationStatus('📍 ' + label, 'success');
    return label;
  }

  function clearPreTripMapOverlays() {
    lastPreviewPayload = null;
    lastPreviewRequest = null;
    if (paymentTollCard) paymentTollCard.classList.remove('is-visible');
    if (tripExtraCard) tripExtraCard.classList.remove('is-visible');
    if (tripStateCard && !lastTripPayload) tripStateCard.classList.remove('is-visible');
    document.querySelectorAll('.sarca-route-line, .sarca-route-overlay, .sarca-driver-search-overlay').forEach(function (node) {
      node.remove();
    });
  }

  function applyCurrentLocationToPickupCard(position) {
    clearPreTripMapOverlays();
    var previousLabel = lastCurrentLocation && String(lastCurrentLocation.label || '').trim();
    if (!previousLabel || previousLabel === 'Localização atual') previousLabel = '';
    var location = {
      latitude: Number(position.coords.latitude),
      longitude: Number(position.coords.longitude),
      accuracyMeters: Number.isFinite(Number(position.coords.accuracy)) ? Number(position.coords.accuracy) : null,
      // Keep the last named place visible while the fresh GPS point is being
      // reverse-geocoded. The coordinates are replaced immediately; the label
      // is corrected asynchronously when the new point has a street/place.
      label: previousLabel || 'Localização atual'
    };
    lastCurrentLocation = location;
    rememberCurrentLocation(lastCurrentLocation);
    pickupUsesCurrentLocation = true;
    renderCurrentLocationStatus('📍 A identificar a localização atual…', 'pending');
    fillFlutterPickupField(location.label);
    [120, 500, 1000].forEach(function (delay) {
      setTimeout(function () { fillFlutterPickupField(location.label); }, delay);
    });
    window.dispatchEvent(new CustomEvent('sarCa:current-location-ready', { detail: location }));
    return location;
  }

  function applyStoredCurrentLocationToPickupCard() {
    var stored = lastCurrentLocation || window.__SARCA_CURRENT_LOCATION__;
    if (!stored || !isFinite(Number(stored.latitude)) || !isFinite(Number(stored.longitude))) return null;
    clearPreTripMapOverlays();
    lastCurrentLocation = {
      latitude: Number(stored.latitude),
      longitude: Number(stored.longitude),
      accuracyMeters: Number.isFinite(Number(stored.accuracyMeters)) ? Number(stored.accuracyMeters) : null,
      label: String(stored.label || 'Localização atual'),
      placeName: String(stored.placeName || stored.label || 'Localização atual'),
      cached: true
    };
    pickupUsesCurrentLocation = true;
    updateMapDashboardLocationLabel(lastCurrentLocation.label);
    fillFlutterPickupField(lastCurrentLocation.label);
    syncFullMapSurface();
    renderCurrentLocationStatus('📍 ' + lastCurrentLocation.label + ' · a atualizar…', 'pending');
    window.dispatchEvent(new CustomEvent('sarCa:current-location-ready', { detail: lastCurrentLocation }));
    startNearbyDriversPolling();
    return lastCurrentLocation;
  }

  async function publishRiderLocation(position) {
    var authorization = lastAuthHeader || loadStoredAuthHeader();
    if (!authorization) throw new Error('Entra na tua conta para enviar a localização à Central.');
    var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/admin-get-sarca-map-data', {
      method: 'POST',
      headers: {
        Authorization: authorization,
        apikey: SARCA_SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Associate live rider heartbeats with the current trip so the
        // driver's tracking response can show the passenger's real position.
        tripId: lastTripPayload && lastTripPayload.trip && lastTripPayload.trip.id
          ? lastTripPayload.trip.id
          : null,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      }),
    });
    var payload = null;
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok || !payload || payload.ok !== true) {
      throw new Error(payload && payload.error ? payload.error : 'Não foi possível enviar a localização à Central.');
    }
    return payload;
  }

  function publishRiderPositionSafely(position) {
    var now = Date.now();
    if (now - lastRiderLocationPublishedAt < 12000) return;
    lastRiderLocationPublishedAt = now;
    publishRiderLocation(position).catch(function () {});
  }

  function handleRiderPosition(position) {
    if (!position || !position.coords) return;
    var previousLabel = lastCurrentLocation && lastCurrentLocation.label;
    lastCurrentLocation = {
      latitude: Number(position.coords.latitude),
      longitude: Number(position.coords.longitude),
      accuracyMeters: Number.isFinite(Number(position.coords.accuracy)) ? Number(position.coords.accuracy) : null,
      label: previousLabel && previousLabel !== 'Localização atual' ? previousLabel : 'Localização atual',
    };
    rememberCurrentLocation(lastCurrentLocation);
    syncFullMapMapObjects();
    publishRiderPositionSafely(position);
  }

  function startRiderLocationPublishing() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(handleRiderPosition, function () {}, {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 15000,
    });
    if (riderLocationWatchId == null) {
      riderLocationWatchId = navigator.geolocation.watchPosition(handleRiderPosition, function () {}, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      });
    }
    if (!riderLocationPublishTimer) {
      riderLocationPublishTimer = setInterval(function () {
        navigator.geolocation.getCurrentPosition(handleRiderPosition, function () {}, {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 15000,
        });
      }, 30000);
    }
  }

  function requestCurrentLocationForPickup() {
    var actionKey = 'location:pickup';
    if (!beginRiderAction(actionKey)) return;
    if (!window.navigator || !window.navigator.geolocation) {
      showLocationShortcutState('Ativa a localização no navegador/dispositivo', 'error');
      endRiderAction(actionKey);
      return;
    }
    // Give the passenger immediate feedback from the last valid GPS fix while
    // the browser obtains a fresher fix. This avoids making the card wait for
    // high-accuracy GPS or reverse geocoding.
    var cachedLocation = applyStoredCurrentLocationToPickupCard();
    showLocationShortcutState(
      cachedLocation ? '✓ Origem preenchida' : 'A obter localização…',
      cachedLocation ? 'success' : 'loading'
    );
    navigator.geolocation.getCurrentPosition(async function (position) {
      try {
        var location = applyCurrentLocationToPickupCard(position);
        startNearbyDriversPolling();
        // Fill the card and draw the GPS marker immediately. Reverse geocoding,
        // central sync and weather must not keep the location button spinning.
        resolveNearestLocalPlace(location).then(function (resolved) {
          commitResolvedPickupLabel(resolved || location);
        }).catch(function () {
          commitResolvedPickupLabel(location);
        });
        publishRiderLocation(position).catch(function () {});
        startRiderLocationPublishing();
        showLocationShortcutState('✓ Origem preenchida', 'success');
        setTimeout(function () { showLocationShortcutState('Usar localização atual', 'idle'); }, 2600);
      } finally {
        endRiderAction(actionKey);
      }
    }, function () {
      try {
        if (cachedLocation) {
          showLocationShortcutState('✓ Origem preenchida', 'success');
          renderCurrentLocationStatus('📍 ' + cachedLocation.label, 'success');
          setTimeout(function () { showLocationShortcutState('Usar localização atual', 'idle'); }, 1800);
          return;
        }
        showLocationShortcutState('Permite a localização para continuar', 'error');
        setTimeout(function () { showLocationShortcutState('Usar localização atual', 'idle'); }, 4200);
      } finally {
        endRiderAction(actionKey);
      }
    }, { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 });
  }

  function installLocationShortcut() {
    if (document.getElementById('sarca-location-shortcut')) return;
    locationShortcut = el('div', 'sarca-location-shortcut');
    locationShortcut.id = 'sarca-location-shortcut';
    locationShortcutButton = el('button', '', 'Usar localização atual');
    locationShortcutButton.type = 'button';
    locationShortcutButton.addEventListener('click', requestCurrentLocationForPickup);
    locationShortcut.appendChild(locationShortcutButton);
    document.body.appendChild(locationShortcut);
  }

  function loadVoiceMode() {
    try {
      var saved = localStorage.getItem('sarCa-voice-mode');
      if (saved === 'voice' || saved === 'effects' || saved === 'silent') voiceMode = saved;
    } catch (_) {}
  }

  function voiceModeLabel() {
    return voiceMode === 'voice' ? 'Voz e efeitos' : voiceMode === 'effects' ? 'Só efeitos' : 'Silencioso';
  }

  function cycleVoiceMode() {
    voiceMode = voiceMode === 'voice' ? 'effects' : voiceMode === 'effects' ? 'silent' : 'voice';
    try { localStorage.setItem('sarCa-voice-mode', voiceMode); } catch (_) {}
    if (voiceMode === 'silent' && voiceAudio) {
      try { voiceAudio.pause(); voiceAudio.currentTime = 0; } catch (_) {}
    }
    renderTripState(lastTripPayload);
  }

  function playVoiceEffect() {
    try { if (navigator.vibrate) navigator.vibrate(35); } catch (_) {}
    try {
      var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      var context = new AudioContextCtor();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.16);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.start(); oscillator.stop(context.currentTime + 0.16);
    } catch (_) {}
  }

  function voiceAssetForEvent(eventKey) {
    var key = String(eventKey || '');
    if (key.indexOf('searching_driver') >= 0 || key.indexOf('offered_to_driver') >= 0) return 'rider_searching.mp3';
    if (key.indexOf('driver_assigned') >= 0) return 'rider_found.mp3';
    // Arrival is a stronger, authoritative event than proximity. Check it
    // first so the rider never hears "almost there" after the driver has
    // already been validated at the pickup point.
    if (key.indexOf('driver_arriving') >= 0 && key.indexOf('wait_active') >= 0) return 'rider_arrived.mp3';
    if (key.indexOf('driver_arriving') >= 0 && key.indexOf(':near') >= 0) return 'rider_near.mp3';
    if (key.indexOf('driver_arriving') >= 0) return 'rider_arriving.mp3';
    if (key.indexOf('in_progress') >= 0) return 'safety_started.mp3';
    if (key.indexOf('completed') >= 0) return 'rider_completed.mp3';
    if (key.indexOf('cancelled_by_driver') >= 0) return 'rider_cancelled.mp3';
    return null;
  }

  function playElevenVoice(eventKey) {
    var file = voiceAssetForEvent(eventKey);
    if (!file || !window.Audio) return;
    try {
      if (voiceAudio) {
        voiceAudio.pause();
        voiceAudio.currentTime = 0;
      }
      voiceAudio = new window.Audio(voiceAssetBase + file);
      voiceAudio.preload = 'auto';
      voiceAudio.volume = 1;
      var result = voiceAudio.play();
      if (result && result.catch) result.catch(function () {});
    } catch (_) {}
  }

  function queueTripAnnouncement(eventKey, text) {
    if (!eventKey || !text || eventKey === voiceLastEvent) return;
    voiceLastEvent = eventKey;
    if (voiceMode === 'silent') return;
    voicePending = { eventKey: eventKey, text: text };
    if (voiceTimer) clearTimeout(voiceTimer);
    // The announcement belongs to an authoritative trip transition. Play it
    // in the same turn as the rendered state instead of making the passenger
    // wait through an arbitrary delay.
    voiceTimer = setTimeout(function () {
      var pending = voicePending; voicePending = null; voiceTimer = null;
      if (!pending || voiceMode === 'silent') return;
      playVoiceEffect();
      if (voiceMode === 'voice') playElevenVoice(pending.eventKey);
    }, 0);
  }

  function driverIsActuallyNearPickup(payload, trip) {
    if (!payload || !trip || !payload.driverNear) return false;
    var presence = getAssignedDriverPresence(payload);
    var driverLat = presenceLatitude(presence);
    var driverLng = presenceLongitude(presence);
    var pickupLat = tripLatitude(trip, 'pickup');
    var pickupLng = tripLongitude(trip, 'pickup');
    if (driverLat == null || driverLng == null || pickupLat == null || pickupLng == null) return false;
    var updatedAt = presence && (presence.updatedAt || presence.updated_at);
    if (updatedAt) {
      var updatedMs = Date.parse(String(updatedAt));
      if (isFinite(updatedMs) && Date.now() - updatedMs > 120000) return false;
    }
    // "Almost there" is deliberately reserved for the final 150 m with a
    // fresh location. Once wait_active is present, the arrival announcement
    // is selected by the authoritative wait state instead.
    return distanceKmBetween(driverLat, driverLng, pickupLat, pickupLng) <= 0.15;
  }

  function announceTripState(payload, trip, wait) {
    if (!trip || !trip.id) return;
    var rawStatus = String(trip.status || '');
    var status = rawStatus;
    if (status === 'driver_assigned' && ['moving', 'en_route', 'heading_to_pickup'].includes(String(trip.driver_progress_state || trip.driverProgressState || '').toLowerCase())) status = 'driver_arriving';
    var suffix = wait && wait.state === 'active' ? ':wait_active' : wait && wait.state === 'paused' ? ':wait_paused' : '';
    var driverNear = driverIsActuallyNearPickup(payload, trip);
    // Preserve the acceptance announcement even if the first authoritative
    // snapshot already reports the driver moving towards the pickup.
    var voiceStatus = rawStatus === 'driver_assigned' ? 'driver_assigned' : status;
    // payment_pending is the terminal trip event from the driver's side. Use
    // the same voice key as completed so the arrival announcement is played
    // once, not once before and once after the payment is settled.
    var voiceKeyStatus = voiceStatus === 'payment_pending' ? 'completed' : voiceStatus;
    var key = String(trip.id) + ':' + voiceKeyStatus + suffix + (driverNear ? ':near' : '');
    var text = null;
    if (voiceStatus === 'searching_driver' || voiceStatus === 'offered_to_driver') text = 'A procurar um motorista para si.';
    else if (voiceStatus === 'driver_assigned') text = 'Motorista encontrado! Veja os detalhes da sua viagem.';
    else if (voiceStatus === 'driver_arriving' && wait && wait.state === 'active') text = 'O seu motorista já chegou. Confirme a matrícula antes de entrar.';
    else if (voiceStatus === 'driver_arriving' && driverNear) text = 'O seu motorista está quase a chegar. Prepare-se.';
    else if (voiceStatus === 'driver_arriving') text = 'O seu motorista está a caminho.';
    else if (voiceStatus === 'in_progress') text = 'Bem-vindo à SARCA. A viagem começou. Por motivos de segurança, registamos o percurso desta viagem. Viaje com confiança.';
    else if (voiceStatus === 'payment_pending' || voiceStatus === 'completed') text = 'Chegámos ao seu destino. Obrigado por viajar com a SARCA!';
    else if (voiceStatus === 'cancelled_by_driver') text = 'O motorista cancelou. Vamos procurar outro para si.';
    if (text) queueTripAnnouncement(key, text);
  }

  function installNearbyDriversCard() {
    if (nearbyDriversCard) return;
    nearbyDriversCard = el('section', 'sarca-nearby-drivers-card');
    nearbyDriversCard.id = 'sarca-nearby-drivers-card';
    document.body.appendChild(nearbyDriversCard);
    renderNearbyDrivers([], new Date());
  }

  function renderNearbyDrivers(drivers, updatedAt) {
    if (!nearbyDriversCard) return;
    var activeTrip = lastTripPayload && lastTripPayload.trip && !['completed', 'cancelled', 'cancelled_by_driver', 'no_driver_found', 'payment_pending'].includes(String(lastTripPayload.trip.status || ''));
    if (activeTrip) {
      nearbyDriversCard.classList.remove('is-visible');
      return;
    }
    var list = Array.isArray(drivers) ? drivers.slice(0, 8) : [];
    nearbyDriversCard.innerHTML = '';
    var header = el('div', 'sarca-nearby__header');
    header.appendChild(el('span', 'sarca-nearby__title', list.length ? 'Motoristas perto de ti' : 'A procurar motoristas próximos…'));
    var updated = updatedAt ? new Date(updatedAt) : new Date();
    header.appendChild(el('span', 'sarca-nearby__updated', 'Agora · ' + (isNaN(updated.getTime()) ? '--:--' : updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))));
    nearbyDriversCard.appendChild(header);
    var body = el('div', 'sarca-nearby__body');
    var radar = el('div', 'sarca-nearby__radar');
    radar.appendChild(el('i', 'sarca-nearby__center'));
    var reference = lastCurrentLocation;
    list.slice(0, 5).forEach(function (driver) {
      if (reference && isFinite(Number(driver.currentLat)) && isFinite(Number(driver.currentLng))) {
        var verticalKm = distanceKmBetween(reference.latitude, reference.longitude, Number(driver.currentLat), reference.longitude);
        var horizontalKm = distanceKmBetween(reference.latitude, reference.longitude, reference.latitude, Number(driver.currentLng));
        var x = 27 + Math.max(-23, Math.min(23, (Number(driver.currentLng) >= reference.longitude ? 1 : -1) * horizontalKm * 3.2));
        var y = 27 + Math.max(-23, Math.min(23, (Number(driver.currentLat) >= reference.latitude ? -1 : 1) * verticalKm * 3.2));
        var dot = el('i', 'sarca-nearby__dot');
        dot.style.left = x + 'px';
        dot.style.top = y + 'px';
        dot.title = String(driver.vehicleLabel || 'Motorista SARCA');
        radar.appendChild(dot);
      }
    });
    body.appendChild(radar);
    var lines = el('div', 'sarca-nearby__list');
    if (!list.length) {
      lines.appendChild(el('div', 'sarca-nearby__muted', lastCurrentLocation ? 'A atualizar disponibilidade…' : 'Ativa a localização para ver motoristas próximos.'));
    } else {
      list.slice(0, 5).forEach(function (driver) {
        var distance = Number(driver.distanceToPickupKm);
        var distanceLabel = isFinite(distance) ? (distance < 1 ? Math.round(distance * 1000) + ' m' : distance.toFixed(1) + ' km') : 'perto';
        lines.appendChild(el('div', 'sarca-nearby__driver', '🚗 ' + String(driver.vehicleLabel || 'SARCA') + ' · ' + distanceLabel));
      });
      if (list.length > 5) lines.appendChild(el('div', 'sarca-nearby__muted', '+' + (list.length - 5) + ' motoristas ativos na zona'));
    }
    body.appendChild(lines);
    nearbyDriversCard.appendChild(body);
    nearbyDriversCard.classList.add('is-visible');
  }

  async function loadNearbyDrivers() {
    if (!lastCurrentLocation || !isFinite(Number(lastCurrentLocation.latitude)) || !isFinite(Number(lastCurrentLocation.longitude))) return;
    var authorization = lastAuthHeader || loadStoredAuthHeader();
    if (!authorization) return;
    try {
      var params = new URLSearchParams({
        latitude: String(lastCurrentLocation.latitude),
        longitude: String(lastCurrentLocation.longitude),
        radiusKm: '8',
        limit: '8',
      });
      params.set('mode', 'nearby');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/admin-get-sarca-map-data?' + params.toString(), {
        headers: { Authorization: authorization, apikey: SARCA_SUPABASE_KEY },
      });
      if (!response.ok) return;
      var payload = await response.json().catch(function () { return {}; });
      if (!payload || payload.ok !== true) return;
      lastNearbyDrivers = Array.isArray(payload.nearbyDrivers) ? payload.nearbyDrivers : [];
      lastNearbyUpdatedAt = payload.updatedAt || new Date().toISOString();
      renderNearbyDrivers(lastNearbyDrivers, lastNearbyUpdatedAt);
      syncFullMapMapObjects();
    } catch (_) {}
  }

  function startNearbyDriversPolling() {
    if (nearbyDriversTimer) clearInterval(nearbyDriversTimer);
    loadNearbyDrivers();
    nearbyDriversTimer = setInterval(loadNearbyDrivers, 15000);
  }

  function stopTripTrackingPolling() {
    if (tripTrackingTimer) clearInterval(tripTrackingTimer);
    tripTrackingTimer = null;
    tripTrackingTripId = null;
    tripTrackingInFlight = false;
  }

  function stopWaitDisplayTimer() {
    if (waitDisplayTimer) clearInterval(waitDisplayTimer);
    waitDisplayTimer = null;
  }

  function waitDisplaySeconds(wait) {
    if (!wait || !['active', 'paused'].includes(String(wait.state || ''))) return 0;
    var seconds = Math.max(0, Number(wait.accumulated_wait_seconds || 0));
    if (String(wait.state || '') === 'active' && wait.observed_at) {
      var observedAt = Date.parse(String(wait.observed_at));
      if (isFinite(observedAt)) seconds += Math.max(0, Math.floor((Date.now() - observedAt) / 1000));
    }
    return Math.floor(seconds);
  }

  function waitClock(seconds) {
    var safe = Math.max(0, Math.floor(Number(seconds) || 0));
    var minutes = String(Math.floor(safe / 60)).padStart(2, '0');
    var remainder = String(safe % 60).padStart(2, '0');
    return minutes + ':' + remainder;
  }

  function renderWaitCounter(wait) {
    if (!tripStateCard) return;
    var counter = tripStateCard.querySelector('.sarCa-wait-countdown');
    if (!counter) return;
    var seconds = waitDisplaySeconds(wait);
    var tolerance = Math.max(300, Number(wait && wait.tolerance_seconds || 0));
    var expired = seconds >= tolerance;
    counter.classList.toggle('is-expired', expired);
    counter.textContent = expired
      ? 'Já passaram 5 minutos. O motorista pode cancelar por ausência sem penalização.'
      : 'Espera do motorista: ' + waitClock(seconds) + ' / 05:00 · Após 5 minutos, o motorista pode cancelar a viagem.';
  }

  function syncWaitDisplayTimer(payload) {
    var trip = payload && payload.trip;
    var wait = payload && payload.wait;
    var waiting = trip && String(trip.status || '') === 'driver_arriving' &&
      wait && ['active', 'paused'].includes(String(wait.state || ''));
    if (!waiting) {
      stopWaitDisplayTimer();
      return;
    }
    renderWaitCounter(wait);
    if (waitDisplayTimer) return;
    waitDisplayTimer = setInterval(function () {
      if (lastTripPayload && lastTripPayload.wait) renderWaitCounter(lastTripPayload.wait);
    }, 1000);
  }

  function syncTripTrackingPolling(payload) {
    var trip = payload && payload.trip;
    var status = trip && String(trip.status || '');
    var active = trip && trip.id && !['completed', 'cancelled', 'cancelled_by_driver', 'no_driver_found', 'payment_pending'].includes(status);
    if (!active) {
      stopTripTrackingPolling();
      if (lastCurrentLocation) startNearbyDriversPolling();
      return;
    }
    if (nearbyDriversTimer) clearInterval(nearbyDriversTimer);
    nearbyDriversTimer = null;
    if (tripTrackingTripId === trip.id && tripTrackingTimer) return;
    stopTripTrackingPolling();
    tripTrackingTripId = trip.id;
    tripTrackingTimer = setInterval(function () {
      if (tripTrackingInFlight) return;
      tripTrackingInFlight = true;
      refreshTripTracking(trip.id).finally(function () { tripTrackingInFlight = false; });
    }, 4000);
  }

  function requestMapFollow(payload) {
    var trip = payload && payload.trip;
    if (!trip) {
      removeLiveMapOverlay();
      if (passengerCameraButton) passengerCameraButton.hidden = true;
      return;
    }
    var status = String(trip.status || '');
    var active = ['driver_assigned', 'driver_arriving', 'in_progress'].includes(status);
    document.documentElement.classList.toggle('sarCa-following-trip', active);
    if (!active) {
      removeLiveMapOverlay();
      if (passengerCameraButton) passengerCameraButton.hidden = true;
      return;
    }
    var presence = getAssignedDriverPresence(payload) || {};
    // O Mapbox é a única superfície de rota. A camada SVG antiga criava uma
    // barra azul por cima do mapa e duplicava o marcador do motorista.
    removeLiveMapOverlay();
    syncFullMapMapObjects();
    window.dispatchEvent(new CustomEvent('sarCa:map-follow', {
      detail: {
        mode: 'follow',
        driverLatitude: presenceLatitude(presence),
        driverLongitude: presenceLongitude(presence),
        pickupLatitude: tripLatitude(trip, 'pickup'),
        pickupLongitude: tripLongitude(trip, 'pickup'),
        destinationLatitude: tripLatitude(trip, 'dropoff'),
        destinationLongitude: tripLongitude(trip, 'dropoff'),
      },
    }));
  }

  function removeLiveMapOverlay() {
    if (liveMapOverlay && liveMapOverlay.parentNode) liveMapOverlay.parentNode.removeChild(liveMapOverlay);
    liveMapOverlay = null;
    liveMapOverlaySvg = null;
  }

  function ensureLiveMapOverlay() {
    if (liveMapOverlay && liveMapOverlaySvg) return liveMapOverlaySvg;
    liveMapOverlay = el('div', '');
    liveMapOverlay.id = 'sarCa-live-map-overlay';
    liveMapOverlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    liveMapOverlaySvg.setAttribute('width', '100%');
    liveMapOverlaySvg.setAttribute('height', '100%');
    liveMapOverlaySvg.setAttribute('aria-hidden', 'true');
    liveMapOverlay.appendChild(liveMapOverlaySvg);
    document.body.appendChild(liveMapOverlay);
    return liveMapOverlaySvg;
  }

  function svgNode(tag, attributes) {
    var node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, String(attributes[key])); });
    return node;
  }

  function liveRoutePoints(payload) {
    var trip = payload && payload.trip;
    if (!trip) return [];
    var progress = payload.tripProgress || {};
    var live = progress.liveRoute;
    if (live && Array.isArray(live.points) && live.points.length >= 2) {
      return live.points.map(function (point) {
        return { latitude: Number(point.latitude), longitude: Number(point.longitude) };
      }).filter(function (point) { return isFinite(point.latitude) && isFinite(point.longitude); });
    }
    var presence = getAssignedDriverPresence(payload) || {};
    var driver = { latitude: presenceLatitude(presence), longitude: presenceLongitude(presence) };
    var rider = lastCurrentLocation || window.__SARCA_CURRENT_LOCATION__ || null;
    var pickup = { latitude: tripLatitude(trip, 'pickup'), longitude: tripLongitude(trip, 'pickup') };
    var destination = { latitude: tripLatitude(trip, 'dropoff'), longitude: tripLongitude(trip, 'dropoff') };
    var target = String(trip.status || '') === 'in_progress' ? destination : pickup;
    if (driver.latitude == null || driver.longitude == null || target.latitude == null || target.longitude == null) return [];
    return [driver, target];
  }

  function renderLiveMapOverlay(payload) {
    var trip = payload && payload.trip;
    var status = trip && String(trip.status || '');
    if (!trip || !['driver_assigned', 'driver_arriving', 'in_progress'].includes(status)) {
      removeLiveMapOverlay();
      return;
    }
    var svg = ensureLiveMapOverlay();
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    var width = Math.max(320, window.innerWidth || 320);
    var height = Math.max(480, window.innerHeight || 480);
    var presence = getAssignedDriverPresence(payload) || {};
    var driver = { latitude: presenceLatitude(presence), longitude: presenceLongitude(presence) };
    var rider = lastCurrentLocation || window.__SARCA_CURRENT_LOCATION__ || null;
    var pickup = { latitude: tripLatitude(trip, 'pickup'), longitude: tripLongitude(trip, 'pickup') };
    var destination = { latitude: tripLatitude(trip, 'dropoff'), longitude: tripLongitude(trip, 'dropoff') };
    lastTripPayload = payload;
    syncFullMapMapObjects();
    var points = liveRoutePoints(payload);
    if (points.length < 2) {
      liveMapOverlay.classList.add('is-visible');
      return;
    }
    var routePoints = points.concat([rider, pickup, destination, driver]).filter(function (point) {
      return point && point.latitude != null && point.longitude != null;
    });
    var minLat = Math.min.apply(null, routePoints.map(function (point) { return point.latitude; }));
    var maxLat = Math.max.apply(null, routePoints.map(function (point) { return point.latitude; }));
    var minLng = Math.min.apply(null, routePoints.map(function (point) { return point.longitude; }));
    var maxLng = Math.max.apply(null, routePoints.map(function (point) { return point.longitude; }));
    var latSpan = Math.max(0.002, maxLat - minLat);
    var lngSpan = Math.max(0.002, maxLng - minLng);
    var pad = 90;
    var scale = Math.min((width - pad * 2) / lngSpan, (height - 240) / latSpan);
    var project = function (point) {
      return {
        x: pad + (point.longitude - minLng) * scale,
        y: 150 + (maxLat - point.latitude) * scale,
      };
    };
    var projected = points.map(project);
    var path = projected.map(function (point, index) { return (index ? 'L' : 'M') + point.x.toFixed(1) + ' ' + point.y.toFixed(1); }).join(' ');
    svg.appendChild(svgNode('path', { class: 'sarCa-live-route-shadow', d: path }));
    svg.appendChild(svgNode('path', { class: 'sarCa-live-route', d: path }));
    // Keep an authoritative live driver marker in the same overlay as the
    // route. This remains visible even while Mapbox tiles/layers are loading
    // or a restored trip has not finished rebuilding its GeoJSON source.
    if (driver.latitude != null && driver.longitude != null) {
      var driverPoint = project(driver);
      svg.appendChild(svgNode('circle', {
        class: 'sarCa-live-point sarCa-live-driver',
        cx: driverPoint.x.toFixed(1),
        cy: driverPoint.y.toFixed(1),
        r: 12,
      }));
      svg.appendChild(svgNode('text', {
        x: driverPoint.x.toFixed(1),
        y: (driverPoint.y - 18).toFixed(1),
        'text-anchor': 'middle',
      })).textContent = 'Motorista';
    }
    liveMapOverlay.classList.add('is-visible');
  }

  function isDriverOffLiveRoute(latitude, longitude) {
    if (!lastLiveRoute || !Array.isArray(lastLiveRoute.points) || !lastLiveRoute.points.length) return false;
    var nearestKm = Infinity;
    lastLiveRoute.points.forEach(function (point) {
      if (!Array.isArray(point) || point.length < 2) return;
      nearestKm = Math.min(nearestKm, distanceKmBetween(latitude, longitude, Number(point[1]), Number(point[0])));
    });
    return nearestKm > 0.18;
  }

  function routeManeuverIcon(type, modifier) {
    if (type === 'roundabout' || type === 'rotary' || type === 'exit roundabout') return '⟳';
    if (modifier === 'left' || modifier === 'slight left' || modifier === 'sharp left') return '↰';
    if (modifier === 'right' || modifier === 'slight right' || modifier === 'sharp right') return '↱';
    return '↑';
  }

  function routeManeuverInstruction(type, modifier, name, exit) {
    if (type === 'arrive') return 'Chegaste ao destino';
    if (type === 'depart') return name ? 'Siga pela ' + name : 'Siga em frente';
    if (type === 'roundabout' || type === 'rotary' || type === 'exit roundabout') {
      return exit ? 'Saia na ' + exit + 'ª saída da rotunda' : 'Entre na rotunda';
    }
    var direction = modifier === 'left' || modifier === 'slight left' || modifier === 'sharp left'
      ? 'à esquerda'
      : modifier === 'right' || modifier === 'slight right' || modifier === 'sharp right'
        ? 'à direita'
        : 'em frente';
    return name ? 'Vire ' + direction + ' para ' + name : 'Vire ' + direction;
  }

  function routeManeuvers(route) {
    var maneuvers = [];
    var cumulativeMeters = 0;
    (Array.isArray(route && route.legs) ? route.legs : []).forEach(function (leg) {
      (Array.isArray(leg && leg.steps) ? leg.steps : []).forEach(function (step) {
        var maneuver = step && maneuverObject(step.maneuver);
        var location = maneuver && Array.isArray(maneuver.location) ? maneuver.location : null;
        if (!maneuver || !location || location.length < 2) return;
        var type = String(maneuver.type || '');
        var modifier = maneuver.modifier ? String(maneuver.modifier) : '';
        var name = String(step.name || '').trim();
        var distanceMeters = Number(step.distance || 0);
        if (!isFinite(distanceMeters)) distanceMeters = 0;
        var exit = maneuver.exit == null ? null : Number(maneuver.exit);
        var instruction = String(maneuver.instruction || '').trim() || routeManeuverInstruction(type, modifier, name, exit);
        maneuvers.push({
          type: type,
          modifier: modifier,
          name: name,
          exit: isFinite(exit) ? exit : null,
          instruction: instruction,
          icon: routeManeuverIcon(type, modifier),
          distanceFromStartMeters: cumulativeMeters,
          distanceMeters: distanceMeters,
          location: [Number(location[0]), Number(location[1])],
        });
        cumulativeMeters += distanceMeters;
      });
    });
    return maneuvers;
  }

  function maneuverObject(value) {
    return value && typeof value === 'object' ? value : null;
  }

  function nextRouteManeuver(maneuvers) {
    var list = Array.isArray(maneuvers) ? maneuvers : [];
    return list.find(function (maneuver) {
      return maneuver && maneuver.type !== 'depart' && maneuver.type !== 'arrive' && Number(maneuver.distanceFromStartMeters) >= 20;
    }) || list.find(function (maneuver) {
      return maneuver && maneuver.type !== 'depart' && maneuver.type !== 'arrive';
    }) || null;
  }

  function maneuverDistanceLabel(maneuver) {
    var meters = Number(maneuver && maneuver.distanceFromStartMeters);
    if (!isFinite(meters)) return '';
    return meters >= 1000 ? (meters / 1000).toFixed(1) + ' km' : Math.max(10, Math.round(meters / 10) * 10) + ' m';
  }

  function maneuverDisplayText(maneuver) {
    if (!maneuver) return '';
    var instruction = String(maneuver.instruction || '').trim();
    if (!instruction) instruction = routeManeuverInstruction(maneuver.type, maneuver.modifier, maneuver.name, maneuver.exit);
    if (instruction.toLowerCase().indexOf('cheg') >= 0) return instruction;
    var distance = maneuverDistanceLabel(maneuver);
    return distance ? instruction + ' daqui a ' + distance : instruction;
  }

  async function recalculateLiveRoute(payload) {
    var trip = payload && payload.trip;
    var presence = getAssignedDriverPresence(payload);
    if (!trip || !presence || !['driver_assigned', 'driver_arriving', 'in_progress'].includes(String(trip.status || ''))) return;
    var driverLat = presenceLatitude(presence);
    var driverLng = presenceLongitude(presence);
    var status = String(trip.status || '');
    var targetLat = status === 'in_progress' ? tripLatitude(trip, 'dropoff') : tripLatitude(trip, 'pickup');
    var targetLng = status === 'in_progress' ? tripLongitude(trip, 'dropoff') : tripLongitude(trip, 'pickup');
    if (driverLat == null || driverLng == null || targetLat == null || targetLng == null) return;
    var driverOffRoute = isDriverOffLiveRoute(driverLat, driverLng);
    if (Date.now() - liveRouteRequestAt < 15000 && !driverOffRoute) return;
    liveRouteRequestAt = Date.now();
    try {
      var url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' + driverLng + ',' + driverLat + ';' + targetLng + ',' + targetLat + '?alternatives=false&geometries=geojson&overview=full&steps=true&language=pt&access_token=' + encodeURIComponent(SARCA_MAPBOX_TOKEN);
      var response = await fetch(url);
      var data = await response.json().catch(function () { return {}; });
      var route = data && Array.isArray(data.routes) ? data.routes[0] : null;
      var coordinates = route && route.geometry && Array.isArray(route.geometry.coordinates) ? route.geometry.coordinates : [];
      if (!route || coordinates.length < 2) return;
      var routeDistanceKm = Number(route.distance) / 1000;
      var routeDurationSeconds = Number(route.duration);
      var maneuvers = routeManeuvers(route);
      var nextManeuver = nextRouteManeuver(maneuvers);
      var previous = lastLiveRoute;
      var changed = !!previous && (Math.abs(routeDistanceKm - previous.distanceKm) > 0.25 || coordinates.length !== previous.points.length);
      lastLiveRoute = { distanceKm: routeDistanceKm, durationSeconds: routeDurationSeconds, points: coordinates, maneuvers: maneuvers, nextManeuver: nextManeuver };
      if (!payload.tripProgress) payload.tripProgress = {};
      payload.tripProgress.liveRoute = {
        points: coordinates.map(function (point) { return { longitude: Number(point[0]), latitude: Number(point[1]) }; }),
        distanceKm: Math.round(routeDistanceKm * 100) / 100,
        durationSeconds: Math.round(routeDurationSeconds),
        maneuvers: maneuvers,
        nextManeuver: nextManeuver,
      };
      removeLiveMapOverlay();
      syncFullMapMapObjects();
      if (changed || !previous) {
        payload.tripProgress.routeRecalculated = true;
        payload.tripProgress.routeRecalculatedAt = new Date().toISOString();
        window.dispatchEvent(new CustomEvent('sarCa:route-recalculated', { detail: payload.tripProgress.liveRoute }));
        renderTripState(payload);
      }
    } catch (_) {}
  }

  function money(value) {
    var amount = Number(value);
    return isFinite(amount) ? amount.toFixed(2) + ' MZN' : '--';
  }

  function paymentLabel(method) {
    return method === 'cash' ? 'Dinheiro' : 'Carteira móvel';
  }

  function capturePreviewRequest(body) {
    if (typeof body !== 'string') return;
    try {
      var parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object') {
        lastPreviewRequest = parsed;
      }
    } catch (_) {}
  }

  function capturePreviewRequestFromInput(input, init, url) {
    if (!url || url.indexOf('preview-trip-offers') === -1) return;
    if (init && init.body) {
      capturePreviewRequest(init.body);
      return;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      try {
        input.clone().text().then(function (body) { capturePreviewRequest(body); }).catch(function () {});
      } catch (_) {}
    }
  }

  function captureAuthHeader(input, init) {
    try {
      var headers = init && init.headers;
      var value = null;
      if (headers && typeof headers.get === 'function') value = headers.get('Authorization');
      else if (headers && typeof headers === 'object') value = headers.Authorization || headers.authorization;
      if (!value && input && input.headers && typeof input.headers.get === 'function') value = input.headers.get('Authorization');
      // Map requests use the publishable key as a fallback Authorization
      // header. It is not a user session and must never replace the JWT used
      // by the authenticated trip/profile endpoints.
      if (value && String(value).trim() !== 'Bearer ' + String(SARCA_SUPABASE_KEY || '').trim() && !/^Bearer\s+sb_publishable_/i.test(String(value))) {
        lastAuthHeader = value;
      }
    } catch (_) {}
  }

  // Reuse the Supabase session kept by the Flutter shell when the custom map
  // flow is used before the network bridge has observed an authenticated call.
  // The token is kept in memory only and is never exposed in the UI or logs.
  function readStoredAuthSession() {
    try {
      for (var index = 0; index < window.localStorage.length; index += 1) {
        var key = window.localStorage.key(index) || '';
        // The Flutter shell persists the rider session under this key. The
        // previous implementation only accepted Supabase auth-token keys,
        // which made a valid login look anonymous after reopening the app.
        if (!/auth-token|rider-mobile-session|sarCa-demo-auth|sarCa-auth-session/i.test(key)) continue;
        var raw = window.localStorage.getItem(key);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        var session = parsed && (parsed.currentSession || parsed.session || parsed);
        var accessToken = session && (session.access_token || session.accessToken);
        var refreshToken = session && (session.refresh_token || session.refreshToken);
        if (accessToken || refreshToken) return {
          key: key,
          parsed: parsed,
          session: session,
          accessToken: accessToken || null,
          refreshToken: refreshToken || null,
        };
      }
    } catch (_) {}
    return null;
  }

  function loadStoredAuthHeader() {
    if (lastAuthHeader && String(lastAuthHeader).trim() !== 'Bearer ' + String(SARCA_SUPABASE_KEY || '').trim() && !/^Bearer\s+sb_publishable_/i.test(String(lastAuthHeader))) return lastAuthHeader;
    lastAuthHeader = null;
    var stored = readStoredAuthSession();
    if (stored && stored.accessToken) {
      lastAuthHeader = 'Bearer ' + String(stored.accessToken);
      return lastAuthHeader;
    }
    return null;
  }

  function persistRefreshedAuthSession(stored, payload) {
    try {
      if (!stored || !stored.key || !stored.parsed || !payload || !payload.access_token) return;
      var next = JSON.parse(JSON.stringify(stored.parsed));
      var target = next.currentSession || next.session || next;
      target.access_token = payload.access_token;
      if (payload.refresh_token) target.refresh_token = payload.refresh_token;
      if (payload.expires_in != null) target.expires_in = payload.expires_in;
      if (payload.expires_at != null) target.expires_at = payload.expires_at;
      window.localStorage.setItem(stored.key, JSON.stringify(next));
    } catch (_) {}
  }

  async function getAuthenticatedAuthHeader() {
    var authHeader = loadStoredAuthHeader();
    if (authHeader) {
      try {
        var check = await window.fetch(SARCA_SUPABASE_URL + '/auth/v1/user', {
          headers: { apikey: SARCA_SUPABASE_KEY, Authorization: authHeader }
        });
        if (check.ok) return authHeader;
      } catch (_) {}
    }
    var stored = readStoredAuthSession();
    if (!stored || !stored.refreshToken) return null;
    try {
      var response = await window.fetch(SARCA_SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { apikey: SARCA_SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: stored.refreshToken })
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok || !payload.access_token) return null;
      persistRefreshedAuthSession(stored, payload);
      lastAuthHeader = 'Bearer ' + String(payload.access_token);
      return lastAuthHeader;
    } catch (_) {
      return null;
    }
  }

  function clearStoredAuthHeader() {
    lastAuthHeader = null;
    try {
      for (var index = 0; index < window.localStorage.length; index += 1) {
        var key = window.localStorage.key(index) || '';
        if (/auth-token/i.test(key)) {
          var raw = window.localStorage.getItem(key);
          if (raw) return;
        }
      }
    } catch (_) {}
  }

  function appendPaymentError(message) {
    if (!paymentTollCard) return;
    var existing = paymentTollCard.querySelector('.sarca-payment-error');
    if (existing) existing.remove();
    paymentTollCard.appendChild(el('div', 'sarca-payment-error', message));
  }

  function selectedServiceClassFromPreview() {
    var request = lastPreviewRequest || {};
    var value = request.serviceClass || request.service_class || '';
    value = String(value).trim().toLowerCase();
    return ['economico', 'conforto', 'moto', 'txopela'].indexOf(value) !== -1 ? value : null;
  }

  function effectiveServiceClass(payload) {
    var selected = selectedServiceClassFromPreview();
    if (selected) return selected;
    var offers = payload && Array.isArray(payload.offers) ? payload.offers : [];
    var nearby = offers.find(function (offer) {
      return offer && Number(offer.nearbyDriverCount || offer.nearby_driver_count || 0) > 0;
    });
    var value = nearby && (nearby.serviceClass || nearby.service_class);
    value = String(value || '').trim().toLowerCase();
    return ['economico', 'conforto', 'moto', 'txopela'].indexOf(value) !== -1 ? value : null;
  }

  function requestFromPreviewRoute() {
    if (lastPreviewRequest) {
      var request = Object.assign({}, lastPreviewRequest);
      request.serviceClass = selectedServiceClassFromPreview() || effectiveServiceClass(lastPreviewPayload);
      return request;
    }
    var route = lastPreviewPayload && lastPreviewPayload.route;
    if (!route || !route.pickupAddress || !route.dropoffAddress) return null;
    return {
      pickupAddress: route.pickupAddress,
      dropoffAddress: route.dropoffAddress,
      pickupLat: route.pickupLat,
      pickupLng: route.pickupLng,
      dropoffLat: route.dropoffLat,
      dropoffLng: route.dropoffLng,
      distanceKm: route.distanceKm,
      durationSeconds: route.durationSeconds,
      routePoints: route.routePoints,
      city: 'Maputo',
      paymentMethod: 'cash',
      serviceClass: effectiveServiceClass(lastPreviewPayload),
    };
  }

  async function confirmTripFromPreview(confirmButton, payment) {
    if (requestInFlight) return;
    var base = requestFromPreviewRoute();
    if (!base) {
      appendPaymentError('Confirma primeiro a origem e o destino para preparar o pedido.');
      return;
    }
    if (negotiationChoice === 'negotiation') {
      var proposed = Number(negotiationProposedFare);
      if (!isFinite(proposed) || proposed <= 0) {
        appendPaymentError('Indica o valor que queres propor antes de continuar.');
        return;
      }
      base.proposedFare = proposed;
      base.pricingMode = 'negotiation';
    } else {
      delete base.proposedFare;
      delete base.proposedFareMinor;
      base.pricingMode = 'suggested';
    }
    base.paymentMethod = explicitPaymentChoice || payment.selectedMethod || 'cash';
    base.pointsToUse = explicitPointsChoice;
    clearPassengerRatingBeforeNewRequest();
    requestInFlight = true;
    confirmButton.disabled = true;
    confirmButton.textContent = 'A enviar pedido…';
    try {
      var headers = { 'Content-Type': 'application/json', apikey: SARCA_SUPABASE_KEY };
      var authHeader = await getAuthenticatedAuthHeader();
      if (!authHeader) throw new Error('A tua sessão expirou. Entra novamente para confirmar a viagem.');
      headers.Authorization = authHeader;
      var response = await window.fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-request-trip', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(base),
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || 'Não foi possível enviar o pedido agora.');
      lastTripPayload = payload;
      renderPaymentToll(payload);
      handleTripResponse(SARCA_SUPABASE_URL + '/functions/v1/sarca-request-trip', payload);
    } catch (error) {
      confirmButton.disabled = false;
      confirmButton.textContent = 'CONFIRMAR PEDIDO';
      if (paymentTollCard) paymentTollCard.classList.add('is-visible');
      // All lower cards go through one arbiter. A failed request must not
      // resurrect the payment card on top of an active trip card.
      syncPassengerCardLayout('payment');
      appendPaymentError(error && error.message ? error.message : 'Não foi possível enviar o pedido agora.');
    } finally {
      requestInFlight = false;
    }
  }

  function numberOrNull(value) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : null;
  }

  function coordinateValue(object, keys) {
    if (!object || typeof object !== 'object') return null;
    for (var index = 0; index < keys.length; index += 1) {
      var value = numberOrNull(object[keys[index]]);
      if (value != null) return value;
    }
    return null;
  }

  function tripLatitude(trip, kind) {
    return coordinateValue(trip, kind === 'pickup'
      ? ['pickup_lat', 'pickupLat', 'pickupLatitude', 'origin_latitude']
      : ['dropoff_lat', 'dropoffLat', 'dropoffLatitude', 'destination_latitude']);
  }

  function tripLongitude(trip, kind) {
    return coordinateValue(trip, kind === 'pickup'
      ? ['pickup_lng', 'pickupLng', 'pickupLongitude', 'origin_longitude']
      : ['dropoff_lng', 'dropoffLng', 'dropoffLongitude', 'destination_longitude']);
  }

  function getAssignedDriverPresence(payload) {
    if (!payload || typeof payload !== 'object') return null;
    var direct = payload.driverPresence || payload.driver_presence || payload.driverLocation || payload.driver_location;
    if (direct) return direct;
    var trip = payload.trip && typeof payload.trip === 'object' ? payload.trip : null;
    var nested = trip && (trip.driverPresence || trip.driver_presence || trip.driverLocation || trip.driver_location);
    if (nested) return nested;
    if (trip && (trip.driver_lat != null || trip.driver_lng != null)) {
      return {
        currentLat: trip.driver_lat,
        currentLng: trip.driver_lng,
        updatedAt: trip.driver_location_updated_at || null,
      };
    }
    var details = payload.driverDetails || (trip && trip.driverDetails);
    if (details && (details.currentLat != null || details.currentLng != null)) {
      return {
        currentLat: details.currentLat,
        currentLng: details.currentLng,
        updatedAt: details.locationUpdatedAt || null,
      };
    }
    return null;
  }

  function presenceLatitude(presence) {
    return coordinateValue(presence, ['currentLat', 'current_lat', 'latitude', 'driver_latitude']);
  }

  function presenceLongitude(presence) {
    return coordinateValue(presence, ['currentLng', 'current_lng', 'longitude', 'driver_longitude']);
  }

  function presenceHeading(presence) {
    var value = coordinateValue(presence, ['headingDegrees', 'heading_degrees', 'heading', 'bearing']);
    return value != null && isFinite(Number(value)) ? Number(value) : 0;
  }

  function appendPickupReferenceEditor(container) {
    var label = el('label', 'sarca-reference__label', 'Referência de recolha (opcional)');
    var input = document.createElement('input');
    input.className = 'sarca-reference__input';
    input.type = 'text';
    input.maxLength = 160;
    input.placeholder = 'Ex.: portão azul, em frente à farmácia';
    input.value = pickupReference;
    input.autocomplete = 'street-address';
    input.addEventListener('input', function () {
      pickupReference = input.value.slice(0, 160);
    });
    label.appendChild(input);
    container.appendChild(label);
    container.appendChild(el('div', 'sarca-payment-toll__muted', 'Ajuda o motorista a encontrar a entrada certa.'));
  }

  function installPaymentTollCard() {
    if (paymentTollCard) return;
    paymentTollCard = el('section', 'sarca-payment-toll-card');
    paymentTollCard.id = 'sarca-payment-toll-card';
    document.body.appendChild(paymentTollCard);
  }

  // Flutter may repaint the dashboard after the cached category quote is
  // selected. Keep the confirmation summary as the single active card until
  // the passenger confirms or cancels it; otherwise it disappears after a
  // short delay even though the route and prices are already valid.
  function keepMapDashboardSummaryVisible() {
    if (mapDashboardSummaryKeepAlive) clearInterval(mapDashboardSummaryKeepAlive);
    if (!mapDashboardSummaryLock) return;
    mapDashboardSummaryKeepAlive = setInterval(function () {
      if (!mapDashboardSummaryLock) {
        clearInterval(mapDashboardSummaryKeepAlive);
        mapDashboardSummaryKeepAlive = null;
        return;
      }
      if (lastTripPayload && lastTripPayload.trip) {
        mapDashboardSummaryLock = false;
        clearInterval(mapDashboardSummaryKeepAlive);
        mapDashboardSummaryKeepAlive = null;
        return;
      }
      if (paymentTollCard) paymentTollCard.classList.add('is-visible');
      if (mapDashboardPanel) {
        mapDashboardPanel.classList.add('is-summary');
        mapDashboardPanel.classList.remove('is-trip-active');
      }
    }, 100);
  }

  // Only one floating card may own the lower part of the screen. Keeping this
  // decision in one place prevents a late payment/search response from
  // painting over the active trip card.
  function syncPassengerCardLayout(preferredMode) {
    if (mapDashboardSummaryLock && (!preferredMode || preferredMode === 'none')) {
      preferredMode = 'payment';
    }
    var mode = preferredMode || null;
    var stateVisible = tripStateCard && tripStateCard.classList.contains('is-visible') &&
      !tripStateCard.classList.contains('is-accepted-hidden');
    var extraVisible = tripExtraCard && tripExtraCard.classList.contains('is-visible');
    var paymentVisible = paymentTollCard && paymentTollCard.classList.contains('is-visible');
    if (!mode) mode = extraVisible ? 'extra' : paymentVisible ? 'payment' : stateVisible ? 'state' : 'none';
    if (mode === 'payment') {
      if (tripStateCard) tripStateCard.classList.remove('is-visible');
      if (tripExtraCard) tripExtraCard.classList.remove('is-visible');
      if (mapDashboardPanel) {
        mapDashboardPanel.classList.add('is-summary');
        mapDashboardPanel.classList.remove('is-trip-active');
      }
      return;
    }
    if (mode === 'extra' || mode === 'state') {
      if (mode === 'extra' && tripStateCard) tripStateCard.classList.remove('is-visible');
      if (mode === 'state' && tripExtraCard) tripExtraCard.classList.remove('is-visible');
      if (paymentTollCard) paymentTollCard.classList.remove('is-visible');
      if (mapDashboardPanel) {
        mapDashboardPanel.classList.remove('is-summary');
        mapDashboardPanel.classList.add('is-trip-active');
      }
      return;
    }
    if (tripStateCard) tripStateCard.classList.remove('is-visible');
    if (tripExtraCard) tripExtraCard.classList.remove('is-visible');
    if (paymentTollCard) paymentTollCard.classList.remove('is-visible');
    if (mapDashboardPanel) mapDashboardPanel.classList.remove('is-summary', 'is-trip-active');
  }

  function renderPaymentToll(payload) {
    if (!paymentTollCard || !payload || typeof payload !== 'object') return;
    // Once the request exists, the dashboard should stay map-first. The
    // complete summary belongs to the trip history/details view; keeping a
    // second summary card here duplicated route, fare and payment information
    // and covered the map.
    if (payload.trip) {
      mapDashboardSummaryLock = false;
      if (mapDashboardSummaryKeepAlive) {
        clearInterval(mapDashboardSummaryKeepAlive);
        mapDashboardSummaryKeepAlive = null;
      }
      paymentTollCard.classList.remove('is-visible');
      paymentTollCard.innerHTML = '';
      syncPassengerCardLayout();
      return;
    }
    var pricing = payload.pricing || {};
    var payment = payload.payment || {};
    var offers = Array.isArray(payload.offers) ? payload.offers : [];
    var tollAmount = Number(pricing.tollAmount || 0);
    if (!tollAmount && offers.length) {
      tollAmount = Number((offers.find(function (offer) { return Number(offer && offer.tollAmount || 0) > 0; }) || {}).tollAmount || 0);
    }
    var hasToll = isFinite(tollAmount) && tollAmount > 0;
    var total = Number(pricing.totalFare || 0);
    var selectedServiceClass = effectiveServiceClass(payload);
    if (!payload.trip && !selectedServiceClass) {
      paymentTollCard.classList.remove('is-visible');
      paymentTollCard.innerHTML = '';
      syncPassengerCardLayout();
      return;
    }
    var previewQuote = offers.find(function (offer) {
      return offer && String(offer.serviceClass || offer.service_class || '').toLowerCase() === selectedServiceClass;
    }) || offers[0] || {};
    if (!total && previewQuote.estimatedFare != null) total = Number(previewQuote.estimatedFare);
    var pickupAdjustment = Number(pricing.pickupAdjustment || pricing.pickup_adjustment || 0);
    var returnAdjustment = Number(pricing.returnAdjustment || pricing.return_adjustment || 0);
    if (!pickupAdjustment && pricing.pickup_adjustment_minor != null) pickupAdjustment = Number(pricing.pickup_adjustment_minor) / 100;
    if (!returnAdjustment && pricing.return_adjustment_minor != null) returnAdjustment = Number(pricing.return_adjustment_minor) / 100;
    var options = (payment.options || []).filter(function (option) {
      return option && option.available !== false;
    });
    if (!options.some(function (option) { return option.method === 'cash'; })) options.push({ method: 'cash', label: 'Dinheiro' });
    if (!options.some(function (option) { return option.method === 'wallet'; })) options.push({ method: 'wallet', label: 'Carteira móvel', description: 'O sistema deteta automaticamente M-Pesa ou e-Mola.' });
    if (!hasToll && !payload.trip && !offers.length) {
      paymentTollCard.classList.remove('is-visible');
      syncPassengerCardLayout();
      return;
    }
    paymentTollCard.innerHTML = '';
    var title = payload.trip ? 'Resumo do pedido' : 'Resumo antes de confirmar';
    paymentTollCard.appendChild(el('div', 'sarca-payment-toll__title', title));
    // Keep the route essentials visible in the summary. Previously this card
    // showed only price/payment information and made the passenger lose the
    // confirmed origin, destination, category and route estimate.
    var summaryTrip = payload.trip || {};
    var summaryRequest = lastPreviewRequest || {};
    var summaryOrigin = firstTripValue(summaryTrip, ['pickup_address', 'pickupAddress'], firstTripValue(summaryRequest, ['pickupAddress', 'pickup_address'], ''));
    var summaryDestination = firstTripValue(summaryTrip, ['dropoff_address', 'dropoffAddress'], firstTripValue(summaryRequest, ['dropoffAddress', 'dropoff_address'], ''));
    var summaryCategory = firstTripValue(summaryTrip, ['service_label', 'service_class'], firstTripValue(summaryRequest, ['serviceClass', 'service_class'], selectedServiceClass || ''));
    var summaryDistance = firstTripValue(summaryTrip, ['distance_km', 'distanceKm'], firstTripValue(summaryRequest, ['distanceKm', 'distance_km'], ''));
    var summaryDuration = firstTripValue(summaryTrip, ['duration_seconds', 'durationSeconds'], firstTripValue(summaryRequest, ['durationSeconds', 'duration_seconds'], ''));
    if (summaryOrigin) paymentTollCard.appendChild(el('div', 'sarCa-payment-toll__route-line', '📍 Origem: ' + summaryOrigin));
    if (summaryDestination) paymentTollCard.appendChild(el('div', 'sarCa-payment-toll__route-line', '🎯 Destino: ' + summaryDestination));
    if (summaryCategory) paymentTollCard.appendChild(el('div', 'sarCa-payment-toll__line', 'Categoria: ' + summaryCategory));
    if (summaryDistance !== '' || summaryDuration !== '') {
      var routeEstimate = [];
      if (summaryDistance !== '' && isFinite(Number(summaryDistance))) routeEstimate.push(Number(summaryDistance).toFixed(1) + ' km');
      if (summaryDuration !== '' && isFinite(Number(summaryDuration))) routeEstimate.push(Math.max(1, Math.round(Number(summaryDuration) / 60)) + ' min');
      if (routeEstimate.length) paymentTollCard.appendChild(el('div', 'sarCa-map-dashboard-route-estimate', '🛣️ ' + routeEstimate.join(' · ')));
    }
    if (hasToll) {
      paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line', 'Portagem incluída: ' + money(tollAmount)));
      paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line sarca-payment-toll__muted', 'O valor já foi acrescentado automaticamente. Não precisas escrever a portagem.'));
      paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line sarca-payment-toll__muted', 'A comissão SARCA não é calculada sobre a portagem.'));
    }
    if (pickupAdjustment) paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line', 'Ajuste de recolha: ' + money(pickupAdjustment)));
    if (returnAdjustment) paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line', 'Ajuste de retorno: ' + money(returnAdjustment)));
    if (pricing.commissionPromotion && typeof pricing.commissionPromotion === 'string') {
      paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line sarca-payment-toll__muted', 'Promoção: ' + pricing.commissionPromotion));
    }
    var pointsDiscountBase = total;
    var commissionableCandidate = pricing.commissionableFare || pricing.commissionable_fare || previewQuote.commissionableFare || previewQuote.commissionable_fare;
    if (commissionableCandidate != null && isFinite(Number(commissionableCandidate))) {
      pointsDiscountBase = Number(commissionableCandidate);
      if (pointsDiscountBase > 10000) pointsDiscountBase = pointsDiscountBase / 100;
    }
    var pointsDiscountLine = null;
    var pointsTotalLine = null;
    function updatePointsSummary(pointsValue) {
      var selectedPoints = Math.max(0, Number(pointsValue || 0));
      var discount = Math.round(pointsDiscountBase * Math.min(5, selectedPoints / 100) / 100 * 100) / 100;
      if (pointsDiscountLine) {
        pointsDiscountLine.textContent = selectedPoints > 0 ? 'Desconto por pontos: -' + money(discount) : '';
        pointsDiscountLine.hidden = selectedPoints <= 0;
      }
      if (pointsTotalLine) {
        pointsTotalLine.textContent = selectedPoints > 0 ? 'Total após pontos: ' + money(Math.max(0, total - discount)) : '';
        pointsTotalLine.hidden = selectedPoints <= 0;
      }
    }
    if (total > 0) paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line', 'Total estimado: ' + money(total)));
    if (!payload.trip && total > 0) {
      pointsDiscountLine = el('div', 'sarca-payment-toll__line sarca-payment-toll__muted', '');
      pointsTotalLine = el('div', 'sarca-payment-toll__line', '');
      pointsDiscountLine.hidden = true;
      pointsTotalLine.hidden = true;
      paymentTollCard.appendChild(pointsDiscountLine);
      paymentTollCard.appendChild(pointsTotalLine);
    }
    if (!payload.trip) {
      var availablePoints = Math.max(0, Number(riderPointsSummary.available_points || 0));
      var pointsBox = el('div', 'sarca-points-choice');
      pointsBox.appendChild(el('div', 'sarca-payment-toll__muted', availablePoints > 0 ? 'Usar pontos no preço da viagem' : 'Pontos SARCA: ainda não disponíveis'));
      if (availablePoints > 0) {
        var pointsBalance = el('div', 'sarca-payment-toll__line', 'Saldo: ' + availablePoints + ' pontos · 100 pontos = 1% (máx. 5%)');
        pointsBalance.dataset.sarcaPointsBalance = 'true';
        pointsBox.appendChild(pointsBalance);
        [0, 100, 200, 300, 400, 500].filter(function (value) { return value === 0 || value <= availablePoints; }).forEach(function (value) {
          var pointsButton = el('button', '', value === 0 ? 'Sem desconto' : value + ' pontos');
          pointsButton.type = 'button';
          pointsButton.classList.toggle('is-selected', explicitPointsChoice === value);
          pointsButton.addEventListener('click', function () {
            explicitPointsChoice = value;
            pointsBox.querySelectorAll('button').forEach(function (button) { button.classList.remove('is-selected'); });
            pointsButton.classList.add('is-selected');
            updatePointsSummary(value);
          });
          pointsBox.appendChild(pointsButton);
        });
      }
      paymentTollCard.appendChild(pointsBox);
      updatePointsSummary(explicitPointsChoice);
    }
    var suggestedFare = Number(pricing.suggestedFare || pricing.commissionableFare || previewQuote.commissionableFare || 0);
    if (!payload.trip && suggestedFare > 0) {
      paymentTollCard.appendChild(el('div', 'sarca-payment-toll__muted', 'Modo de preço'));
      paymentTollCard.appendChild(el('div', 'sarca-payment-toll__line', 'Preço sugerido: ' + money(suggestedFare)));
      var priceChoices = el('div', 'sarca-price-choice');
      var suggestedButton = el('button', '', 'Pedir pelo preço sugerido');
      var proposeButton = el('button', '', 'Propor preço');
      var proposalInput = document.createElement('input');
      proposalInput.className = 'sarca-negotiation-input';
      proposalInput.type = 'number';
      proposalInput.min = '1';
      proposalInput.step = '1';
      proposalInput.placeholder = 'O teu valor em MZN';
      proposalInput.value = negotiationProposedFare;
      proposalInput.addEventListener('input', function () { negotiationProposedFare = proposalInput.value; });
      function selectPriceMode(mode) {
        negotiationChoice = mode;
        suggestedButton.classList.toggle('is-selected', mode === 'suggested');
        proposeButton.classList.toggle('is-selected', mode === 'negotiation');
        proposalInput.classList.toggle('is-visible', mode === 'negotiation');
        suggestedButton.textContent = mode === 'suggested' ? '✓ Pedir pelo preço sugerido' : 'Pedir pelo preço sugerido';
        proposeButton.textContent = mode === 'negotiation' ? '✓ Propor preço' : 'Propor preço';
      }
      suggestedButton.addEventListener('click', function () { selectPriceMode('suggested'); });
      proposeButton.addEventListener('click', function () { selectPriceMode('negotiation'); proposalInput.focus(); });
      priceChoices.appendChild(suggestedButton);
      priceChoices.appendChild(proposeButton);
      paymentTollCard.appendChild(priceChoices);
      paymentTollCard.appendChild(proposalInput);
      selectPriceMode(negotiationChoice === 'negotiation' ? 'negotiation' : 'suggested');
    }
    // A forma de pagamento aparece apenas no recibo depois da viagem.
    // O resumo pré-confirmação não deve mostrar nem permitir escolher pagamento.
    // A referência só é necessária para entregas; no pedido de viagem não
    // ocupar espaço no resumo nem competir com a escolha do pagamento.
    if (lastPreviewRequest && lastPreviewRequest.serviceType === 'delivery') {
      appendPickupReferenceEditor(paymentTollCard);
    }
    if (!payload.trip) {
      var confirmButton = el('button', 'sarca-payment-confirm', 'CONFIRMAR PEDIDO');
      confirmButton.type = 'button';
      confirmButton.setAttribute('aria-label', 'Confirmar pedido');
      confirmButton.addEventListener('click', function () {
        confirmTripFromPreview(confirmButton, payment);
      });
      paymentTollCard.appendChild(confirmButton);
    }
    paymentTollCard.classList.add('is-visible');
    syncPassengerCardLayout('payment');
  }

  function tripStateLabel(status, wait) {
    if (status === 'searching_driver' || status === 'offered_to_driver') return ['A procurar motorista', 'Estamos a encontrar um profissional disponível.'];
    if (status === 'driver_assigned') return ['Pedido aceite', 'O motorista foi associado à tua viagem.'];
    if (status === 'driver_arriving' && wait && wait.state === 'active') return ['O teu motorista chegou', 'A espera só conta enquanto ele permanece no ponto de recolha.'];
    if (status === 'driver_arriving' && wait && wait.state === 'paused') return ['Espera pausada', 'O motorista saiu do raio de recolha; a cobrança está pausada.'];
    if (status === 'driver_arriving') return ['Motorista a caminho', 'O percurso até ao ponto de recolha está ativo.'];
    if (status === 'in_progress') return ['Serviço em andamento', 'Por motivos de segurança, registamos o percurso desta viagem.'];
    if (status === 'payment_pending') return ['A fechar a viagem', 'Estamos a confirmar o pagamento e o recibo.'];
    if (status === 'completed') return ['Serviço concluído', 'Confirma o pagamento e avalia a experiência.'];
    if (status === 'no_driver_found') return ['Sem motorista disponível', 'Ainda não há motoristas disponíveis perto de ti.'];
    return [null, null];
  }

  function minorOrAmount(object, minorKey, amountKey) {
    if (!object || typeof object !== 'object') return 0;
    var minor = numberOrNull(object[minorKey]);
    if (minor != null) return minor / 100;
    var amount = numberOrNull(object[amountKey]);
    return amount == null ? 0 : amount;
  }

  function appendReceiptRow(receipt, label, value) {
    if (!value || value === '--') return;
    var row = el('div', 'sarca-extra__receipt-row');
    row.appendChild(el('span', 'sarca-extra__muted', label));
    row.appendChild(el('strong', '', value));
    receipt.appendChild(row);
  }

  function readAccessToken() {
    var stored = readStoredAuthSession();
    return stored && stored.accessToken ? stored.accessToken : null;
  }

  async function reportTripIncident(tripId, eventType) {
    var actionKey = 'incident:' + String(tripId || '') + ':' + String(eventType || 'passenger_cannot_find_driver');
    if (!beginRiderAction(actionKey)) throw new Error('Esta ação já está a ser processada.');
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/report-sarca-safety-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({
          tripId: tripId,
          eventType: eventType || 'passenger_cannot_find_driver',
          details: { source: 'rider_ui', pickupReference: pickupReference.trim() || null },
        }),
      });
      if (!response.ok) throw new Error('Não foi possível enviar o pedido de ajuda');
      return response.json();
    } finally {
      endRiderAction(actionKey);
    }
  }

  async function submitTripRating(tripId, value) {
    var actionKey = 'rating:' + String(tripId || '');
    if (!beginRiderAction(actionKey)) throw new Error('Esta ação já está a ser processada.');
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/rest/v1/rpc/submit_trip_rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({ p_trip_id: tripId, p_rating: value, p_comment: null }),
      });
      if (!response.ok) {
        var failure = await response.json().catch(function () { return {}; });
        throw new Error(failure.message || failure.hint || failure.error || 'Não foi possível guardar a avaliação');
      }
      return response.json();
    } finally {
      endRiderAction(actionKey);
    }
  }

  function isTripAlreadyRatedError(error) {
    var message = String(error && error.message ? error.message : error || '').toLowerCase();
    return message.indexOf('já foi avaliada') !== -1 ||
      message.indexOf('ja foi avaliada') !== -1 ||
      message.indexOf('already been rated') !== -1 ||
      message.indexOf('already rated') !== -1;
  }

  async function confirmTripPayment(tripId, paymentMethod) {
    var actionKey = 'payment:' + String(tripId || '') + ':' + String(paymentMethod || '');
    if (!beginRiderAction(actionKey)) throw new Error('Esta ação já está a ser processada.');
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-progress-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({ tripId: tripId, action: 'confirm_payment', paymentMethod: paymentMethod }),
      });
      if (!response.ok) {
        var failure = await response.json().catch(function () { return {}; });
        throw new Error(failure.message || failure.hint || failure.error || 'Não foi possível confirmar o pagamento');
      }
      return response.json();
    } finally {
      endRiderAction(actionKey);
    }
  }

  async function confirmCashReceipt(tripId) {
    var actionKey = 'cash-receipt:' + String(tripId || '');
    if (!beginRiderAction(actionKey)) throw new Error('Esta ação já está a ser processada.');
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-progress-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({ tripId: tripId, action: 'confirm_cash_receipt' }),
      });
      if (!response.ok) {
        var failure = await response.json().catch(function () { return {}; });
        throw new Error(failure.message || failure.hint || failure.error || 'Não foi possível confirmar o pagamento em cash');
      }
      return response.json();
    } finally {
      endRiderAction(actionKey);
    }
  }

  function playPaymentSuccessEffect() {
    playVoiceEffect();
    try {
      document.body.classList.add('sarCa-payment-settled-flash');
      window.setTimeout(function () { document.body.classList.remove('sarCa-payment-settled-flash'); }, 900);
    } catch (_) {}
  }

  // Payment is a deliberate passenger action after the driver completes the
  // trip. Keep this small client-side acknowledgement so an already-settled
  // legacy trip cannot jump straight to the rating screen on first render.
  // The server remains authoritative and the confirm-payment RPC is
  // idempotent, so repeating the choice never creates a second charge.
  function passengerPaymentChoiceKey(tripId) {
    return 'sarCa:passenger-payment-confirmed:' + String(tripId || '');
  }

  var pendingPassengerRatingKey = 'sarCa:pending-passenger-rating-v1';

  function rememberPendingPassengerRating(tripId) {
    if (!tripId) return;
    try { window.localStorage.setItem(pendingPassengerRatingKey, String(tripId)); } catch (_) {}
  }

  function clearPendingPassengerRating(tripId) {
    try {
      if (!tripId || window.localStorage.getItem(pendingPassengerRatingKey) === String(tripId)) {
        window.localStorage.removeItem(pendingPassengerRatingKey);
      }
    } catch (_) {}
  }

  function pendingPassengerRatingId() {
    try {
      var value = String(window.localStorage.getItem(pendingPassengerRatingKey) || '').trim();
      return value;
    } catch (_) {
      return '';
    }
  }

  // Keep a durable local acknowledgement as a second guard for a just-rated
  // trip. The server remains authoritative; this only prevents a stale tab or
  // a delayed polling response from reopening the same evaluation card.
  var passengerRatedTripKey = 'sarCa:passenger-rated-trip-v1';

  function rememberPassengerRatedTrip(tripId) {
    if (!tripId) return;
    try { window.localStorage.setItem(passengerRatedTripKey, String(tripId)); } catch (_) {}
  }

  function passengerRatedTripId() {
    try { return String(window.localStorage.getItem(passengerRatedTripKey) || '').trim(); } catch (_) { return ''; }
  }

  function passengerRatedTrip(tripId) {
    return !!tripId && passengerRatedTripId() === String(tripId);
  }

  function passengerConfirmedPayment(tripId) {
    if (!tripId) return false;
    try {
      return window.localStorage.getItem(passengerPaymentChoiceKey(tripId)) === '1';
    } catch (error) {
      return false;
    }
  }

  function rememberPassengerPaymentChoice(tripId) {
    if (!tripId) return;
    try {
      window.localStorage.setItem(passengerPaymentChoiceKey(tripId), '1');
    } catch (error) {
      // Private browsing or a restricted WebView may disable localStorage.
    }
  }

  // A new request starts a new passenger flow. Never let a pending rating
  // marker or the old completed-trip card leak into the driver search state.
  function clearPassengerRatingBeforeNewRequest() {
    dismissedCompletedTripId = '';
    try { window.localStorage.removeItem(pendingPassengerRatingKey); } catch (_) {}
    if (tripExtraCard) {
      tripExtraCard.classList.remove('is-visible', 'is-payment-required');
      tripExtraCard.innerHTML = '';
    }
    if (tripStateCard) tripStateCard.classList.remove('is-accepted-hidden');
    syncPassengerCardLayout('none');
  }

  function showPassengerRatingAfterPayment(tripId, paymentMethod) {
    var currentPayload = lastTripPayload;
    var currentTrip = currentPayload && currentPayload.trip;
    if (!currentTrip || String(currentTrip.id || '') !== String(tripId || '')) return;
    rememberPendingPassengerRating(tripId);
    ratingEligibleTripIds[String(tripId)] = true;
    var settledTrip = Object.assign({}, currentTrip, {
      status: 'completed',
      payment_method: paymentMethod,
      payment_status: 'settled',
    });
    renderTripExtras(Object.assign({}, currentPayload, {
      trip: settledTrip,
      myRating: null,
    }));
  }

  function restorePendingPassengerRating() {
    var accessToken = readAccessToken();
    var tripId = '';
    try { tripId = String(window.localStorage.getItem(pendingPassengerRatingKey) || ''); } catch (_) {}
    if (!accessToken || !tripId || !tripExtraCard) return;
    if (passengerRatedTrip(tripId)) {
      clearPendingPassengerRating(tripId);
      return;
    }
    fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-trip-live-tracking?tripId=' + encodeURIComponent(tripId), {
      headers: { Authorization: 'Bearer ' + accessToken, apikey: SARCA_SUPABASE_KEY },
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      var trip = payload && payload.trip;
      if (!trip || String(trip.id || '') !== tripId) return;
      var status = String(trip.status || '').toLowerCase();
      var paymentStatus = String(trip.payment_status || trip.paymentStatus || '').toLowerCase();
      if (payload.myRating || (status === 'completed' && paymentStatus === 'settled')) {
        if (payload.myRating) {
          clearPendingPassengerRating(tripId);
          return;
        }
        lastTripPayload = payload;
        ratingEligibleTripIds[tripId] = true;
        renderTripExtras(payload);
      }
    }).catch(function () {});
  }

  function restoreLatestPassengerRating() {
    var accessToken = readAccessToken();
    if (!accessToken || !tripExtraCard) return;
    // Never resurrect an old completed trip on app start. A rating card is
    // restored only when payment created an explicit pending-rating marker.
    if (!pendingPassengerRatingId()) return;
    var currentStatus = lastTripPayload && lastTripPayload.trip && String(lastTripPayload.trip.status || '').toLowerCase();
    if (currentStatus && !['completed', 'payment_pending'].includes(currentStatus)) return;
    fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-list-my-trips?limit=50', {
      headers: { Authorization: 'Bearer ' + accessToken, apikey: SARCA_SUPABASE_KEY },
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      var trips = payload && Array.isArray(payload.trips) ? payload.trips : [];
      var completed = trips.filter(function (trip) {
        return trip && String(trip.status || '').toLowerCase() === 'completed' &&
          String(trip.payment_status || trip.paymentStatus || '').toLowerCase() === 'settled';
      });
      completed.sort(function (left, right) {
        return new Date(right.completed_at || right.updated_at || 0).getTime() - new Date(left.completed_at || left.updated_at || 0).getTime();
      });
      var candidate = completed[0];
      if (!candidate || !candidate.id) return null;
      if (pendingPassengerRatingId() !== String(candidate.id)) return null;
      if (candidate.my_rating || passengerRatedTrip(candidate.id)) return null;
      return fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-trip-live-tracking?tripId=' + encodeURIComponent(candidate.id), {
        headers: { Authorization: 'Bearer ' + accessToken, apikey: SARCA_SUPABASE_KEY },
      }).then(function (trackingResponse) {
        return trackingResponse.ok ? trackingResponse.json() : null;
      });
    }).then(function (payload) {
      var trip = payload && payload.trip;
      if (!trip || payload.myRating || passengerRatedTrip(trip.id) || String(trip.status || '').toLowerCase() !== 'completed' ||
          String(trip.payment_status || trip.paymentStatus || '').toLowerCase() !== 'settled') return;
      lastTripPayload = payload;
      ratingEligibleTripIds[String(trip.id)] = true;
      rememberPendingPassengerRating(trip.id);
      renderTripExtras(payload);
    }).catch(function () {});
  }

  async function cancelTripBeforeStart(tripId, reasonCode, reasonText) {
    var actionKey = 'cancel:' + String(tripId || '');
    if (!beginRiderAction(actionKey)) throw new Error('Esta ação já está a ser processada.');
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-cancel-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({
          tripId: tripId,
          reasonCode: reasonCode,
          reason: reasonText || 'O passageiro cancelou antes do início da viagem.',
        }),
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) {
        throw new Error(payload && (payload.error || payload.message)
          ? (payload.error || payload.message)
          : 'Não foi possível cancelar a viagem');
      }
      return payload;
    } finally {
      endRiderAction(actionKey);
    }
  }

  function resetPassengerAfterTripCancellation() {
    stopTripTrackingPolling();
    lastTripPayload = null;
    // Do not keep the pre-cancellation nearby-driver snapshot on the map.
    // It may contain the driver that just accepted the cancelled trip or a
    // stale operational record. Fetch a fresh, GPS-backed list instead.
    lastNearbyDrivers = [];
    lastNearbyUpdatedAt = null;
    lastPreviewPayload = null;
    lastPreviewRequest = null;
    lastDestinationSelection = null;
    negotiationChoice = 'suggested';
    negotiationProposedFare = '';
    explicitPaymentChoice = null;
    explicitPointsChoice = 0;
    pickupReference = '';
    if (tripStateCard) {
      tripStateCard.classList.remove('is-visible');
      tripStateCard.innerHTML = '';
    }
    if (tripExtraCard) {
      tripExtraCard.classList.remove('is-visible');
      tripExtraCard.innerHTML = '';
    }
    if (paymentTollCard) {
      paymentTollCard.classList.remove('is-visible');
      paymentTollCard.innerHTML = '';
    }
    if (mapDashboardPanel) mapDashboardPanel.classList.remove('is-summary', 'has-suggestions', 'is-trip-active');
    if (mapDashboardDestinationInput) {
      mapDashboardDestinationInput.value = '';
      mapDashboardDestinationInput.__sarCaSelectedValue = '';
    }
    [mapDashboardPickupReferenceInput, mapDashboardDeliveryReferenceInput, mapDashboardPackageDescriptionInput, mapDashboardRecipientNameInput, mapDashboardRecipientPhoneInput].forEach(function (input) {
      if (input) input.value = '';
    });
    if (mapDashboardPackageSizeSelect) mapDashboardPackageSizeSelect.selectedIndex = 0;
    if (mapDashboardDeliveryDetails) mapDashboardDeliveryDetails.hidden = mapDashboardService !== 'delivery';
    if (mapDashboardRouteAction) {
      mapDashboardRouteAction.hidden = true;
      mapDashboardRouteAction.disabled = false;
      mapDashboardRouteAction.textContent = 'PREPARAR PEDIDO';
    }
    clearDestinationSuggestions();
    document.querySelectorAll('.sarCa-route-line, .sarCa-route-overlay, .sarca-driver-search-overlay').forEach(function (node) { node.remove(); });
    syncFullMapSurface();
    renderNearbyDrivers([], new Date());
    if (lastCurrentLocation) loadNearbyDrivers();
  }

  function returnPassengerHomeAfterRating(tripId) {
    dismissedCompletedTripId = String(tripId || '');
    clearPendingPassengerRating(tripId);
    delete ratingEligibleTripIds[String(tripId || '')];
    resetPassengerAfterTripCancellation();
  }

  function showRiderActionToast(message) {
    var existing = document.getElementById('sarCa-rider-action-toast');
    if (existing) existing.remove();
    var toast = el('div', 'sarCa-rider-action-toast', message);
    toast.id = 'sarCa-rider-action-toast';
    document.body.appendChild(toast);
    window.setTimeout(function () { if (toast.parentNode) toast.remove(); }, 2600);
  }

  function openPassengerConfirmModal(options) {
    var existing = document.getElementById('sarCa-passenger-confirm-modal');
    if (existing) existing.remove();
    options = options || {};
    var modal = el('div', 'sarCa-passenger-confirm-modal');
    modal.id = 'sarCa-passenger-confirm-modal';
    modal.setAttribute('role', 'presentation');
    var dialog = el('section', 'sarCa-passenger-confirm-dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'sarCa-passenger-confirm-title');
    var title = el('h2', '', options.title || 'Confirmar ação');
    title.id = 'sarCa-passenger-confirm-title';
    dialog.appendChild(title);
    dialog.appendChild(el('p', '', options.message || 'Confirma esta ação?'));
    var actions = el('div', 'sarCa-passenger-confirm-actions');
    var continueButton = el('button', '', options.cancelLabel || 'Continuar');
    continueButton.type = 'button';
    var confirmButton = el('button', 'is-danger', options.confirmLabel || 'Confirmar');
    confirmButton.type = 'button';
    var confirmed = false;
    var close = function () { if (modal.parentNode) modal.remove(); };
    continueButton.addEventListener('click', close);
    confirmButton.addEventListener('click', function () {
      if (confirmed) return;
      confirmed = true;
      confirmButton.disabled = true;
      if (typeof options.onConfirm === 'function') options.onConfirm(close, confirmButton);
      else close();
    });
    actions.appendChild(continueButton);
    actions.appendChild(confirmButton);
    dialog.appendChild(actions);
    modal.appendChild(dialog);
    modal.addEventListener('click', function (event) { if (event.target === modal) close(); });
    document.body.appendChild(modal);
    continueButton.focus();
  }

  async function cancelTripWhileSearchingConfirmed(tripId, button, messageNode) {
    if (!tripId || !button) return;
    button.disabled = true;
    button.textContent = 'A cancelar…';
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-cancel-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({
          tripId: tripId,
          reasonCode: 'passenger_cancelled_during_search',
          reason: 'O passageiro cancelou enquanto a SARCA procurava motorista.',
        }),
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || 'Não foi possível cancelar a procura.');
      resetPassengerAfterTripCancellation();
      showRiderActionToast('Procura cancelada.');
    } catch (error) {
      button.disabled = false;
      button.textContent = 'CANCELAR PROCURA';
      if (messageNode) messageNode.textContent = error && error.message ? error.message : 'Não foi possível cancelar agora.';
    }
  }

  function cancelTripWhileSearching(tripId, button, messageNode) {
    if (!tripId || !button) return;
    openPassengerConfirmModal({
      title: 'Cancelar procura de motorista?',
      message: 'Se confirmares, deixaremos de procurar um motorista para esta viagem.',
      cancelLabel: 'Continuar à procura',
      confirmLabel: 'Cancelar procura',
      onConfirm: function (close) {
        close();
        cancelTripWhileSearchingConfirmed(tripId, button, messageNode);
      },
    });
  }

  function showTripHelp(trip) {
    if (!tripExtraCard) return;
    var notice = el('div', 'sarca-extra__notice', 'A enviar pedido de ajuda à Central…');
    tripExtraCard.appendChild(notice);
    window.dispatchEvent(new CustomEvent('sarCa:open-support', { detail: { tripId: trip.id, reason: 'driver_not_found' } }));
    reportTripIncident(trip.id).then(function () {
      notice.textContent = 'Pedido enviado à Central. A cobrança de espera fica pendente de verificação.';
    }).catch(function (error) {
      notice.textContent = error && error.message ? error.message : 'Não foi possível enviar. Abre o suporte e tenta novamente.';
    });
  }

  function showTripMismatch(trip) {
    if (!tripExtraCard) return;
    var notice = el('div', 'sarca-extra__notice', 'A procurar outro motorista sem cobrança e a enviar a ocorrência à Central…');
    tripExtraCard.appendChild(notice);
    cancelTripBeforeStart(trip.id, 'driver_or_vehicle_mismatch').then(function () {
      notice.textContent = 'A procurar outro motorista. A Central recebeu a ocorrência e não haverá penalização.';
    }).catch(function (error) {
      notice.textContent = error && error.message ? error.message : 'Não foi possível procurar outro motorista. Abre o suporte.';
    });
  }

  async function requestTripReassignment(tripId, reasonCode) {
    var actionKey = 'reassign:' + String(tripId || '');
    if (!beginRiderAction(actionKey)) throw new Error('Esta ação já está a ser processada.');
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-progress-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({
          tripId: tripId,
          action: 'reassign_driver',
          reasonCode: reasonCode || 'driver_not_progressing',
          details: { source: 'rider_ui' },
        }),
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || 'Não foi possível procurar outro motorista.');
      return payload;
    } finally {
      endRiderAction(actionKey);
    }
  }

  async function selectTripPriceOffer(tripId, offerId) {
    var actionKey = 'offer:' + String(tripId || '') + ':' + String(offerId || '');
    if (!beginRiderAction(actionKey)) throw new Error('Esta ação já está a ser processada.');
    try {
      var accessToken = readAccessToken();
      if (!accessToken) throw new Error('Sessão necessária');
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-progress-trip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken,
          'apikey': SARCA_SUPABASE_KEY,
        },
        body: JSON.stringify({ tripId: tripId, action: 'select_offer', offerId: offerId }),
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok) throw new Error(payload.error || 'Esta proposta já não está disponível.');
      return payload;
    } finally {
      endRiderAction(actionKey);
    }
  }

  async function refreshTripTracking(tripId) {
    var accessToken = readAccessToken();
    if (!accessToken) return;
    try {
      var response = await fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-trip-live-tracking?tripId=' + encodeURIComponent(tripId), {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'apikey': SARCA_SUPABASE_KEY },
      });
      if (!response.ok) return null;
      var payload = await response.json();
      handleTripResponse('sarca-trip-live-tracking', payload, tripId);
      var status = String(payload && payload.trip && payload.trip.status || '').toLowerCase();
      if (['completed', 'payment_pending'].indexOf(status) !== -1) scheduleRiderCompletionRefresh(tripId);
      return payload;
    } catch (_) { return null; }
  }

  var activePassengerTripRestoreInFlight = false;
  var activePassengerTripRestoreTimer = null;
  var activePassengerTripCacheKey = 'sarCa-active-trip-cache-v1';
    var activePassengerTripStatuses = ['searching_driver', 'offered_to_driver', 'driver_assigned', 'driver_arriving', 'in_progress', 'payment_pending', 'completed'];

  function cacheActivePassengerTrip(payload) {
    try {
      var trip = payload && payload.trip;
      var status = trip && String(trip.status || '').toLowerCase();
      if (!trip || activePassengerTripStatuses.indexOf(status) === -1) {
        window.sessionStorage.removeItem(activePassengerTripCacheKey);
        return;
      }
      window.sessionStorage.setItem(activePassengerTripCacheKey, JSON.stringify({ savedAt: Date.now(), payload: payload }));
    } catch (_) {}
  }

  function restoreCachedPassengerTrip() {
    try {
      var raw = window.sessionStorage.getItem(activePassengerTripCacheKey);
      if (!raw) return;
      var cached = JSON.parse(raw);
      if (!cached || !cached.payload || Date.now() - Number(cached.savedAt || 0) > 6 * 60 * 60 * 1000) {
        window.sessionStorage.removeItem(activePassengerTripCacheKey);
        return;
      }
      var status = String(cached.payload.trip && cached.payload.trip.status || '').toLowerCase();
      if (activePassengerTripStatuses.indexOf(status) === -1) {
        window.sessionStorage.removeItem(activePassengerTripCacheKey);
        return;
      }
      // Do not paint a stale payment/rating card from the previous session.
      // The authoritative tracking response below will restore it only when
      // this exact trip still needs a passenger action.
      if (status === 'completed' || status === 'payment_pending') return;
      lastTripPayload = cached.payload;
      renderTripState(cached.payload);
    } catch (_) {}
  }
  function restoreActivePassengerTrip() {
    if (activePassengerTripRestoreInFlight) return;
    var authorization = lastAuthHeader || loadStoredAuthHeader();
    if (!authorization) return;
    activePassengerTripRestoreInFlight = true;
    fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-list-my-trips?limit=50', {
      headers: { Authorization: authorization, apikey: SARCA_SUPABASE_KEY },
    }).then(function (response) {
      return response.ok ? response.json() : null;
    }).then(function (payload) {
      var trips = payload && Array.isArray(payload.trips) ? payload.trips : [];
      var activeStatuses = ['searching_driver', 'offered_to_driver', 'driver_assigned', 'driver_arriving', 'in_progress', 'payment_pending', 'completed'];
      var activeTrips = trips.filter(function (trip) {
        if (!trip || activeStatuses.indexOf(String(trip.status || '').toLowerCase()) === -1) return false;
        var status = String(trip.status || '').toLowerCase();
        var tripId = String(trip.id || trip.trip_id || '');
        // A completed trip that was already rated must never win restoration
        // over the current request or reopen the rating card on refresh.
        if ((status === 'completed' || status === 'payment_pending') &&
            (trip.my_rating || trip.myRating || passengerRatedTrip(tripId))) return false;
        return true;
      });
      activeTrips.sort(function (left, right) {
        var leftDate = new Date(left.updated_at || left.updatedAt || left.created_at || left.createdAt || 0).getTime();
        var rightDate = new Date(right.updated_at || right.updatedAt || right.created_at || right.createdAt || 0).getTime();
        return rightDate - leftDate;
      });
      var trip = activeTrips[0];
      var tripId = trip && (trip.id || trip.trip_id);
      if (!tripId) return null;
      return fetch(SARCA_SUPABASE_URL + '/functions/v1/sarca-trip-live-tracking?tripId=' + encodeURIComponent(tripId), {
        headers: { Authorization: authorization, apikey: SARCA_SUPABASE_KEY },
      }).then(function (trackingResponse) {
        if (!trackingResponse.ok) return { trip: trip };
        return trackingResponse.json().then(function (tracking) {
          if (!tracking || typeof tracking !== 'object') return { trip: trip };
          if (!tracking.trip) tracking.trip = trip;
          return tracking;
        });
      });
    }).then(function (trackingPayload) {
      if (!trackingPayload || !trackingPayload.trip) {
        // The server is authoritative: once there is no active trip, clear
        // any stale payment/search card kept by a previous browser session.
        clearPendingPassengerRating();
        lastTripPayload = null;
        renderTripState({ trip: null });
        return;
      }
      lastTripPayload = trackingPayload;
      cacheActivePassengerTrip(trackingPayload);
      renderTripState(trackingPayload);
      if (activePassengerTripRestoreTimer) {
        clearInterval(activePassengerTripRestoreTimer);
        activePassengerTripRestoreTimer = null;
      }
    }).catch(function () {}).finally(function () {
      activePassengerTripRestoreInFlight = false;
    });
  }

  function renderTripPriceOffers(trip, payload) {
    if (!trip || trip.pricing_mode !== 'negotiation' || trip.driver_user_id || !tripExtraCard) return false;
    var offers = Array.isArray(payload.priceOffers) ? payload.priceOffers : [];
    var section = el('div', 'sarca-extra__receipt');
    section.appendChild(el('strong', '', 'Propostas de motoristas'));
    section.appendChild(el('div', 'sarca-extra__muted', offers.length ? 'Escolhe uma proposta para confirmar o motorista e o preço.' : 'A aguardar respostas dos motoristas próximos…'));
    if (offers.length) {
      offers.forEach(function (offer) {
        var box = el('div', 'sarca-extra__offer');
        var top = el('div', 'sarca-extra__offer-top');
        var name = offer.driverName || 'Motorista SARCA';
        var vehicle = [offer.vehicleColor, offer.vehicleMake, offer.vehicleModel].filter(Boolean).join(' ');
        top.appendChild(el('span', '', name + (vehicle ? ' · ' + vehicle : '')));
        var amount = Number(offer.agreedFareMinor || offer.counterOfferMinor || offer.proposedFareMinor || 0) / 100;
        top.appendChild(el('span', 'sarca-extra__offer-price', money(amount)));
        box.appendChild(top);
        var rating = offer.rating == null ? 'Novo' : '★ ' + Number(offer.rating).toFixed(1) + ' · ' + Number(offer.ratingCount || 0) + ' viagens';
        var eta = offer.estimatedPickupMinutes ? ' · chega em ' + offer.estimatedPickupMinutes + ' min' : '';
        box.appendChild(el('div', 'sarca-extra__muted', rating + eta + ' · motorista recebe ' + money(Number(offer.driverNetMinor || 0) / 100)));
        var choose = el('button', '', 'Escolher por ' + money(amount));
        choose.type = 'button';
        choose.addEventListener('click', function () {
          choose.disabled = true;
          choose.textContent = 'A confirmar…';
          selectTripPriceOffer(trip.id, offer.offerId).then(function () {
            choose.textContent = 'Motorista escolhido';
            refreshTripTracking(trip.id);
          }).catch(function (error) {
            choose.disabled = false;
            choose.textContent = error && error.message ? error.message : 'Proposta indisponível';
          });
        });
        box.appendChild(choose);
        section.appendChild(box);
      });
    } else if (trip.negotiation_deadline_at) {
      var remaining = Math.max(0, Math.ceil((new Date(trip.negotiation_deadline_at).getTime() - Date.now()) / 1000));
      section.appendChild(el('div', 'sarca-extra__line', remaining > 0 ? 'Pedido aberto por mais ' + remaining + ' s.' : 'O prazo terminou. Podes pedir novamente pelo preço sugerido.'));
    }
    tripExtraCard.appendChild(section);
    return true;
  }

  function firstTripValue(row, keys, fallback) {
    if (!row || typeof row !== 'object') return fallback == null ? '' : fallback;
    for (var index = 0; index < keys.length; index++) {
      var value = row[keys[index]];
      if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return fallback == null ? '' : fallback;
  }

  function normalizedDriverDetails(details) {
    if (!details || typeof details !== 'object') return null;
    var vehicle = details.vehicle && typeof details.vehicle === 'object'
      ? details.vehicle
      : (details.vehicleDetails && typeof details.vehicleDetails === 'object' ? details.vehicleDetails : {});
    var rawPlate = firstTripValue(details,
      ['plateNumber', 'plate_number', 'licensePlate', 'license_plate', 'registration', 'registrationNumber'],
      firstTripValue(vehicle, ['plateNumber', 'plate_number', 'licensePlate', 'license_plate', 'registration', 'registrationNumber'], '')
    );
    var plate = /^pending[-_]/i.test(String(rawPlate || '').trim()) ? '' : rawPlate;
    return {
      fullName: firstTripValue(details, ['fullName', 'full_name', 'driverName', 'driver_name'], 'Motorista associado'),
      phone: firstTripValue(details, ['phone', 'phone_e164', 'phoneE164'], ''),
      avatarUrl: firstTripValue(details, ['avatarUrl', 'avatar_url', 'photoUrl', 'photo_url'], ''),
      rating: firstTripValue(details, ['rating'], ''),
      vehicleMake: firstTripValue(details, ['vehicleMake', 'vehicle_make'], firstTripValue(vehicle, ['vehicleMake', 'vehicle_make', 'make'], '')),
      vehicleModel: firstTripValue(details, ['vehicleModel', 'vehicle_model'], firstTripValue(vehicle, ['vehicleModel', 'vehicle_model', 'model'], '')),
      vehicleColor: firstTripValue(details, ['vehicleColor', 'vehicle_color'], firstTripValue(vehicle, ['vehicleColor', 'vehicle_color', 'color'], '')),
      plateNumber: plate,
    };
  }

  function openRiderCallOptions(phone) {
    var digits = String(phone || '').replace(/[^0-9+]/g, '');
    if (!digits) return;
    var sheet = openMapDashboardProfileSheet('Ligar ao motorista', 'Escolhe como queres contactar.');
    var carrier = profileSheetButton('Ligar pela operadora', function () {
      window.location.href = 'tel:' + digits;
    });
    var data = profileSheetButton('Ligar com dados', function () {
      window.open('https://wa.me/' + digits.replace(/^\+/, ''), '_blank', 'noopener');
    });
    sheet.appendChild(carrier);
    sheet.appendChild(data);
    sheet.appendChild(el('div', 'sarCa-profile-sheet-note', 'A chamada com dados abre o WhatsApp e depende da internet e da conta do contacto.'));
  }

  function tripPaymentLabel(method) {
    var value = String(method || '').toLowerCase();
    if (value === 'cash' || value === 'dinheiro') return 'Dinheiro';
    if (value === 'wallet' || value === 'mobile_money' || value === 'mpesa' || value === 'emola') return 'Carteira móvel';
    return method ? String(method) : 'A confirmar';
  }

  function appendTripDetailRow(panel, label, value) {
    if (value === undefined || value === null || String(value).trim() === '') return;
    var row = el('div', 'sarca-trip-details__row');
    row.appendChild(el('span', '', label));
    row.appendChild(el('span', '', String(value)));
    panel.appendChild(row);
  }

  function quoteSectionValue(section, key, fallback) {
    if (!section || typeof section !== 'object') return fallback || 'Indisponível';
    var value = section[key];
    return value === undefined || value === null || String(value).trim() === '' ? (fallback || 'Indisponível') : value;
  }

  function quoteDistance(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number.toFixed(1) + ' km' : (fallback || 'A confirmar');
  }

  function quoteDuration(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(1, Math.round(number / 60)) + ' min' : (fallback || 'Ainda não iniciado');
  }

  function quoteMoneyMinor(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? money(number / 100) : (fallback || 'A confirmar');
  }

  function appendTripQuoteSection(panel, title, rows) {
    var details = document.createElement('details');
    details.className = 'sarca-trip-details__section';
    // The important trip facts must be readable immediately. The passenger
    // should not have to open several nested accordions to understand the
    // route, timing and price after a trip is completed.
    details.open = true;
    details.style.marginTop = '10px';
    details.style.borderTop = '1px solid rgba(255,255,255,.12)';
    details.style.paddingTop = '6px';
    var summary = document.createElement('summary');
    summary.textContent = title;
    summary.style.cursor = 'pointer';
    summary.style.fontWeight = '800';
    summary.style.padding = '6px 0';
    details.appendChild(summary);
    rows.forEach(function (row) {
      appendTripDetailRow(details, row[0], row[1]);
    });
    panel.appendChild(details);
  }

  function buildTripDetailsPanel(trip, payload) {
    var panel = el('div', 'sarca-trip-details');
    panel.hidden = true;
    panel.appendChild(el('div', 'sarca-trip-details__title', 'Detalhes da viagem'));
    appendTripDetailRow(panel, 'Origem', firstTripValue(trip, ['pickup_address', 'pickupAddress'], 'Origem confirmada'));
    appendTripDetailRow(panel, 'Destino', firstTripValue(trip, ['dropoff_address', 'dropoffAddress'], 'Destino confirmado'));
    appendTripDetailRow(panel, 'Categoria', firstTripValue(trip, ['service_label', 'service_class'], 'Viagem'));
    if (['payment_pending', 'completed'].includes(String(firstTripValue(trip, ['status'], '')))) {
      appendTripDetailRow(panel, 'Pagamento', tripPaymentLabel(firstTripValue(trip, ['payment_method', 'paymentMethod'], '')));
    }
    var distance = firstTripValue(trip, ['distance_km', 'distanceKm'], '');
    appendTripDetailRow(panel, 'Distância', distance !== '' ? Number(distance).toFixed(1) + ' km' : '');
    var duration = firstTripValue(trip, ['duration_seconds', 'durationSeconds'], '');
    appendTripDetailRow(panel, 'Tempo estimado', duration !== '' ? Math.max(1, Math.round(Number(duration) / 60)) + ' min' : '');
    var fare = minorOrAmount(trip, 'final_fare_minor', 'final_fare') || minorOrAmount(trip, 'estimated_fare_minor', 'estimated_fare');
    appendTripDetailRow(panel, 'Valor da viagem', fare ? money(fare) : '');
    var toll = minorOrAmount(trip, 'toll_amount_minor', 'toll_amount');
    if (toll > 0) appendTripDetailRow(panel, 'Portagens', money(toll));
    var pickupPoint = trip.pickup_access_point && typeof trip.pickup_access_point === 'object' ? trip.pickup_access_point : null;
    var reference = pickupPoint ? firstTripValue(pickupPoint, ['label', 'reference'], '') : '';
    appendTripDetailRow(panel, 'Referência', reference);
    if (String(firstTripValue(trip, ['service_type', 'serviceType'], '')).toLowerCase() === 'delivery') {
      var description = firstTripValue(pickupPoint, ['package_description', 'packageDescription'], '') || firstTripValue(trip, ['package_description', 'packageDescription'], '');
      var size = firstTripValue(pickupPoint, ['package_size', 'packageSize'], '') || firstTripValue(trip, ['package_size', 'packageSize'], '');
      var recipient = firstTripValue(pickupPoint, ['recipient_name', 'recipientName'], '') || firstTripValue(trip, ['requested_for_name', 'requestedForName'], '');
      if (description) appendTripDetailRow(panel, 'Conteúdo', description);
      if (size) appendTripDetailRow(panel, 'Tamanho', size);
      if (recipient) appendTripDetailRow(panel, 'Destinatário', recipient);
    }
    var note = firstTripValue(trip, ['passenger_note', 'passengerNote'], '');
    if (note) appendTripDetailRow(panel, 'Observação', note);
    var quote = payload && payload.quoteDetails && typeof payload.quoteDetails === 'object'
      ? payload.quoteDetails
      : null;
    if (quote) {
      var route = quoteSectionValue(quote, 'route', {});
      var time = quoteSectionValue(quote, 'time', {});
      var conditions = quoteSectionValue(quote, 'conditions', {});
      var fuel = quoteSectionValue(quote, 'fuel', {});
      var price = quoteSectionValue(quote, 'price', {});
      appendTripQuoteSection(panel, 'Percurso', [
        ['Distância da viagem', quoteDistance(route.tripDistanceKm)],
        ['Distância motorista → recolha', quoteDistance(route.driverToPickupDistanceKm)],
        ['Total operacional', quoteDistance(route.operationalTotalKm)],
        ['Percurso registado', quoteDistance(route.recordedDistanceKm, 'Ainda não iniciado')],
      ]);
      appendTripQuoteSection(panel, 'Tempo e condições', [
        ['Chegada estimada', time.estimatedPickupMinutes == null ? 'Indisponível' : String(time.estimatedPickupMinutes) + ' min'],
        ['Duração estimada', quoteDuration(time.estimatedTripSeconds)],
        ['Duração registada', quoteDuration(time.recordedTripSeconds, 'Ainda não iniciado')],
        ['Trânsito', quoteSectionValue(conditions, 'traffic', 'Sem ajuste informado')],
        ['Fonte do clima', quoteSectionValue(conditions, 'weatherSource', 'Sem ajuste informado')],
      ]);
      appendTripQuoteSection(panel, 'Formação do preço', [
        ['Base', quoteMoneyMinor(price.baseMinor)],
        ['Distância', quoteMoneyMinor(price.distanceMinor)],
        ['Tempo', quoteMoneyMinor(price.timeMinor)],
        ['Ajuste de zona', quoteMoneyMinor(price.zoneAdjustmentMinor)],
        ['Ajuste de horário', quoteMoneyMinor(price.timeAdjustmentMinor)],
        ['Desconto/subsídio', quoteMoneyMinor(price.discountMinor)],
        ['Portagens', quoteMoneyMinor(price.tollsMinor)],
        ['Total confirmado', quoteMoneyMinor(price.finalMinor)],
      ]);
      appendTripQuoteSection(panel, 'Combustível estimado', [
        ['Tipo', quoteSectionValue(fuel, 'fuelType')],
        ['Preço/litro', quoteMoneyMinor(fuel.pricePerLiterMinor)],
        ['Consumo', fuel.consumptionLPer100Km == null ? 'A confirmar' : String(fuel.consumptionLPer100Km) + ' L/100 km'],
        ['Litros', quoteSectionValue(fuel, 'liters', 'A confirmar')],
        ['Custo estimado', quoteMoneyMinor(fuel.costMinor, 'A confirmar')],
        ['Nota', quoteSectionValue(fuel, 'note', 'Referência operacional SARCA')],
      ]);
    }
    var driver = normalizedDriverDetails(payload && payload.driverDetails);
    if (driver) {
      var driverCard = el('div', 'sarca-extra__identity sarca-extra__identity--details sarca-extra__identity--driver-card');
      if (driver.avatarUrl) {
        var driverImage = document.createElement('img');
        driverImage.className = 'sarca-extra__avatar';
        driverImage.alt = 'Foto do motorista';
        driverImage.src = String(driver.avatarUrl);
        driverImage.addEventListener('error', function () {
          var fallback = el('div', 'sarca-extra__avatar', '🚗');
          fallback.setAttribute('aria-label', 'Foto do motorista indisponível');
          driverImage.replaceWith(fallback);
        });
        driverCard.appendChild(driverImage);
      } else {
        driverCard.appendChild(el('div', 'sarca-extra__avatar', '🚗'));
      }
      var driverCopy = el('div', 'sarca-extra__identity-copy');
      driverCopy.appendChild(el('strong', '', driver.fullName || 'Motorista associado'));
      driverCopy.appendChild(el('span', '', 'Motorista SARCA confirmado'));
      var facts = el('div', 'sarca-extra__identity-facts');
      function addDriverFact(label, value, primary) {
        var fact = el('div', primary ? 'sarca-extra__identity-fact sarca-extra__identity-fact--primary' : 'sarca-extra__identity-fact');
        fact.appendChild(el('span', 'sarca-extra__identity-fact-label', label));
        var fallback = label === 'Matrícula' ? 'Matrícula não cadastrada' : 'A confirmar';
        fact.appendChild(el('span', 'sarca-extra__identity-fact-value', value || fallback));
        facts.appendChild(fact);
      }
      addDriverFact('Contacto', driver.phone, false);
      addDriverFact('Carro', [driver.vehicleMake, driver.vehicleModel].filter(Boolean).join(' '), true);
      addDriverFact('Matrícula', driver.plateNumber, true);
      var driverRating = driver.rating !== '' && driver.rating != null ? '★ ' + Number(driver.rating).toFixed(1) + ' / 5' : '';
      addDriverFact('Avaliação', driverRating, false);
      driverCopy.appendChild(facts);
      driverCard.appendChild(driverCopy);
      panel.appendChild(el('div', 'sarca-trip-details__title', 'Motorista e viatura'));
      panel.appendChild(driverCard);
    }
    return panel;
  }

  function appendTripCancellationControls(trip) {
    if (!tripExtraCard || !trip) return;
    var status = String(trip.status || '');
    if (status !== 'driver_assigned' && status !== 'driver_arriving') return;
    var wrapper = el('div', 'sarca-extra__cancel');
    wrapper.className += ' sarca-extra__cancel--top';
    var actions = el('div', 'sarca-extra__actions');
    var button = el('button', 'is-danger sarca-extra__cancel-main', 'CANCELAR VIAGEM');
    button.type = 'button';
    var reasons = el('div', 'sarca-cancel-reasons');
    reasons.hidden = true;
    reasons.appendChild(el('div', 'sarca-cancel-reasons__title', 'Escolhe o motivo do cancelamento'));
    var options = [
      ['passenger_changed_plans', 'Mudei de planos'],
      ['driver_requested_cancel', 'O motorista pediu para cancelar'],
      ['driver_extra_money', 'Foi exigido dinheiro extra'],
      ['driver_or_vehicle_mismatch', 'O motorista ou a viatura não corresponde'],
      ['passenger_other', 'Outro motivo'],
    ];
    button.addEventListener('click', function () {
      reasons.hidden = !reasons.hidden;
      button.setAttribute('aria-expanded', reasons.hidden ? 'false' : 'true');
      if (!reasons.hidden) reasons.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    actions.appendChild(button);
    wrapper.appendChild(actions);
    options.forEach(function (option) {
      var optionButton = el('button', '', option[1]);
      optionButton.type = 'button';
      optionButton.addEventListener('click', function () {
        openPassengerConfirmModal({
          title: 'Cancelar a viagem?',
          message: 'O motorista está a caminho. Se confirmares, a viagem será cancelada e a SARCA deixará de acompanhar este pedido.',
          cancelLabel: 'Continuar viagem',
          confirmLabel: 'Cancelar viagem',
          onConfirm: function (close) {
            close();
            optionButton.disabled = true;
            optionButton.textContent = 'A cancelar…';
            cancelTripBeforeStart(trip.id, option[0], option[1]).then(function () {
              resetPassengerAfterTripCancellation();
            }).catch(function (error) {
              optionButton.disabled = false;
              optionButton.textContent = option[1];
              var errorNode = el('div', 'sarca-extra__line', error && error.message ? error.message : 'Não foi possível cancelar agora.');
              reasons.appendChild(errorNode);
            });
          },
        });
      });
      reasons.appendChild(optionButton);
    });
    wrapper.appendChild(reasons);
    tripExtraCard.appendChild(wrapper);
  }

  function openRiderTripChat(trip) {
    if (!trip || !trip.id) return;
    var sheet = openMapDashboardProfileSheet('Chat da viagem', 'Fala com o motorista sobre esta viagem.');
    var list = el('div', 'sarCa-profile-sheet-list', 'A carregar mensagens…');
    sheet.appendChild(list);
    var input = document.createElement('textarea');
    input.className = 'sarCa-profile-sheet-input sarCa-profile-sheet-textarea';
    input.placeholder = 'Escreve uma mensagem para o motorista';
    input.maxLength = 1000;
    sheet.appendChild(input);
    var quick = el('div', 'sarCa-extra__actions');
    ['Estou no ponto de recolha', 'Estou a chegar ao local', 'Pode ligar-me, por favor'].forEach(function (text) {
      var quickButton = el('button', '', text);
      quickButton.type = 'button';
      quickButton.addEventListener('click', function () { input.value = text; input.focus(); });
      quick.appendChild(quickButton);
    });
    sheet.appendChild(quick);
    function appendMessage(row) {
      if (!row || !row.body) return;
      var item = el('div', 'sarCa-profile-sheet-notification');
      item.appendChild(el('strong', '', row.sender_user_id === (trip.passenger_user_id || '') ? 'Tu' : 'Motorista'));
      item.appendChild(el('span', '', String(row.body)));
      list.appendChild(item);
    }
    profileRequest('/rest/v1/rpc/sarca_list_trip_messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_trip_id: trip.id }) }).then(function (payload) {
      var rows = payload && Array.isArray(payload.messages) ? payload.messages : [];
      list.textContent = '';
      if (!Array.isArray(rows) || rows.length === 0) list.textContent = 'Ainda não há mensagens nesta viagem.';
      (Array.isArray(rows) ? rows : []).forEach(appendMessage);
    }).catch(function () {
      list.textContent = 'Ainda não há mensagens nesta viagem. Podes enviar a primeira.';
    });
    var send = profileSheetButton('Enviar mensagem', function () {
      var body = String(input.value || '').trim();
      if (!body) {
        profileSheetMessage(sheet, 'Escreve uma mensagem antes de enviar.', 'is-error');
        return;
      }
      send.disabled = true;
      profileRequest('/rest/v1/rpc/sarca_send_trip_message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_trip_id: trip.id, p_body: body }) }).then(function (result) {
        input.value = '';
        if (list.textContent === 'Ainda não há mensagens nesta viagem.') list.textContent = '';
        appendMessage(result && result.message ? result.message : { body: body, sender_user_id: trip.passenger_user_id || '' });
        profileSheetMessage(sheet, 'Mensagem enviada ao motorista.', 'is-success');
      }).catch(function (error) {
        profileSheetMessage(sheet, error.message || 'Não foi possível enviar a mensagem.', 'is-error');
      }).finally(function () { send.disabled = false; });
    });
    sheet.appendChild(send);
    window.dispatchEvent(new CustomEvent('sarCa:open-trip-chat', { detail: { tripId: trip.id } }));
  }

  function renderTripExtras(payload) {
    if (!tripExtraCard || !payload || typeof payload !== 'object') return;
    lastTripPayload = payload;
    var trip = payload.trip || null;
    if (!trip || typeof trip !== 'object') {
      openTripDetailsKey = '';
      tripExtraCard.classList.remove('is-visible');
      syncPassengerCardLayout();
      return;
    }
    var previousDetailsPanel = tripExtraCard.querySelector('.sarca-trip-details');
    if (previousDetailsPanel && !previousDetailsPanel.hidden) {
      openTripDetailsKey = String(trip.id || '');
    }
    var detailSource = Object.assign({},
      trip.driver_details || {},
      trip.driverDetails || {},
      payload.driver_details || {},
      payload.driverDetails || {}
    );
    var details = normalizedDriverDetails(detailSource);
    var presence = getAssignedDriverPresence(payload);
    var reference = trip.pickup_access_point && typeof trip.pickup_access_point === 'object'
      ? String(trip.pickup_access_point.label || '').trim()
      : '';
    var status = String(trip.status || '');
    var paymentStatus = String(trip.payment_status || trip.paymentStatus || '').toLowerCase();
    // Searching is its own UI state. A stale rating card must never remain
    // visible while this trip is waiting for a driver.
    if (status === 'searching_driver' || status === 'offered_to_driver') {
      if (tripExtraCard) {
        tripExtraCard.classList.remove('is-visible', 'is-payment-required');
        tripExtraCard.innerHTML = '';
      }
      syncPassengerCardLayout('state');
      return;
    }
    var passengerConfirmedPaymentChoice = passengerConfirmedPayment(trip.id);
    var myRating = payload.myRating || trip.my_rating || trip.myRating || null;
    if (passengerRatedTrip(trip.id)) myRating = myRating || { localAcknowledgement: true };
    var paymentChoiceRequired = ['payment_pending', 'completed'].indexOf(status) !== -1 && paymentStatus !== 'settled' && !passengerConfirmedPaymentChoice;
    var selectedPaymentMethod = String(trip.payment_method || trip.paymentMethod || '').toLowerCase();
    var cashReceiptPending = selectedPaymentMethod === 'cash' && paymentStatus === 'pending_confirmation' && !passengerConfirmedPaymentChoice;
    var showReceipt = status === 'payment_pending' || (status === 'completed' && paymentStatus !== 'settled') || paymentChoiceRequired;
    var showHelp = status === 'driver_arriving';
    // The driver closes the ride into payment_pending first. It is already a
    // completed service at this point, so both parties can rate immediately;
    // the financial confirmation later only changes the settlement status.
    // Rating is unlocked only after the passenger confirms cash or wallet
    // payment. Never show it while payment is still pending.
    // A settled historical trip is not enough to reopen the rating card after
    // login/refresh. The card is eligible only when this session observed the
    // completion or the passenger just confirmed payment for this trip.
    var ratingEligible = ratingEligibleTripIds[String(trip.id || '')] === true;
    var showRating = (status === 'completed' || status === 'payment_pending') && trip.completed_at != null && paymentStatus === 'settled' && ratingEligible && !myRating;
    if ((status === 'completed' || status === 'payment_pending') && passengerRatedTrip(trip.id) && !paymentChoiceRequired) {
      tripExtraCard.classList.remove('is-visible');
      syncPassengerCardLayout('none');
      return;
    }
    var driverAssigned = status === 'driver_assigned' || status === 'driver_arriving' || status === 'in_progress';
    if (!driverAssigned) {
      details = null;
      reference = '';
      presence = null;
    }
    if (!details && !reference && !showReceipt && !showHelp && !showRating && !presence && !driverAssigned && !(trip.pricing_mode === 'negotiation' && !trip.driver_user_id)) {
      tripExtraCard.classList.remove('is-visible');
      syncPassengerCardLayout();
      return;
    }
    tripExtraCard.innerHTML = '';
    tripExtraCard.classList.toggle('is-payment-required', paymentChoiceRequired);
    var header = el('div', 'sarca-extra__header');
    header.appendChild(el('span', '', driverAssigned ? 'Motorista e viagem' : (showReceipt ? 'A fechar a viagem' : 'Avaliar viagem')));
    header.appendChild(el('span', 'sarca-extra__muted', navigator.onLine === false ? 'Sem internet' : 'Ligado'));
    tripExtraCard.appendChild(header);
    var boardingPin = payload.boardingPin || payload.boarding_pin || null;
    var boardingCode = boardingPin && (boardingPin.code || boardingPin.pin || boardingPin.value);
    if (driverAssigned && status === 'driver_arriving' && boardingCode && !(boardingPin.usedAt || boardingPin.used_at)) {
      tripExtraCard.appendChild(el('div', 'sarca-extra__notice', 'PIN de embarque: ' + String(boardingCode) + ' · diga estes 4 dígitos ao motorista para iniciar a viagem.'));
    }
    if (details) {
      var identity = el('div', 'sarca-extra__identity sarca-extra__identity--driver-card');
      if (details.avatarUrl) {
        var image = document.createElement('img');
        image.className = 'sarca-extra__avatar';
        image.alt = 'Foto do motorista';
        image.src = String(details.avatarUrl);
        image.addEventListener('error', function () {
          var fallback = el('div', 'sarCa-extra__avatar', '🚗');
          fallback.setAttribute('aria-label', 'Foto do motorista indisponível');
          image.replaceWith(fallback);
        });
        identity.appendChild(image);
      } else {
        identity.appendChild(el('div', 'sarca-extra__avatar', '🚗'));
      }
      var identityCopy = el('div', 'sarca-extra__identity-copy');
      identityCopy.appendChild(el('strong', '', 'Motorista: ' + (details.fullName || 'Motorista SARCA')));
      identityCopy.appendChild(el('span', '', 'Motorista e viatura confirmados'));
      var vehicle = [details.vehicleColor, details.vehicleMake, details.vehicleModel].filter(Boolean).join(' ');
      var rating = details.rating !== '' && details.rating != null ? '★ ' + Number(details.rating).toFixed(1) : '';
      var identityFacts = el('div', 'sarca-extra__identity-facts');
      function addIdentityFact(label, value, primary) {
        var fact = el('div', primary ? 'sarca-extra__identity-fact sarca-extra__identity-fact--primary' : 'sarca-extra__identity-fact');
        fact.appendChild(el('span', 'sarca-extra__identity-fact-label', label));
        var fallback = label === 'Matrícula' ? 'Matrícula não cadastrada' : 'A confirmar';
        fact.appendChild(el('span', 'sarca-extra__identity-fact-value', value || fallback));
        identityFacts.appendChild(fact);
      }
      addIdentityFact('Contacto', details.phone, false);
      addIdentityFact('Carro', vehicle, true);
      addIdentityFact('Matrícula', details.plateNumber, true);
      addIdentityFact('Avaliação', rating || 'A confirmar', false);
      identityCopy.appendChild(identityFacts);
      identity.appendChild(identityCopy);
      tripExtraCard.appendChild(identity);
    } else if (driverAssigned) {
      tripExtraCard.appendChild(el('div', 'sarca-extra__line', 'Os dados do motorista estão a sincronizar. O contacto só aparece quando for confirmado pela SARCA.'));
    }
    if (driverAssigned) {
      var driverActions = el('div', 'sarca-extra__actions');
      if (details && details.phone) {
        var call = document.createElement('button');
        call.type = 'button';
        call.textContent = 'Ligar';
        call.addEventListener('click', function () { openRiderCallOptions(details.phone); });
        driverActions.appendChild(call);
      }
      var message = document.createElement('button');
      message.type = 'button';
      var unreadTripMessages = riderUnreadTripMessages(trip.id);
      message.className = unreadTripMessages > 0 ? 'has-unread' : '';
      message.appendChild(document.createTextNode('Chat'));
      if (unreadTripMessages > 0) {
        message.appendChild(el('span', 'sarCa-rider-chat-badge', unreadTripMessages > 99 ? '99+' : String(unreadTripMessages)));
      }
      message.addEventListener('click', function () {
        openRiderTripChat(trip);
      });
      driverActions.appendChild(message);
      var detailsButton = document.createElement('button');
      detailsButton.type = 'button';
      detailsButton.textContent = 'Ver detalhes';
      var detailsPanel = buildTripDetailsPanel(trip, payload);
      var detailsAreOpen = openTripDetailsKey === String(trip.id || '');
      detailsPanel.hidden = !detailsAreOpen;
      detailsButton.textContent = detailsAreOpen ? 'Ocultar detalhes' : 'Ver detalhes';
      detailsButton.setAttribute('aria-expanded', detailsAreOpen ? 'true' : 'false');
      detailsButton.addEventListener('click', function () {
        detailsPanel.hidden = !detailsPanel.hidden;
        openTripDetailsKey = detailsPanel.hidden ? '' : String(trip.id || '');
        detailsButton.setAttribute('aria-expanded', detailsPanel.hidden ? 'false' : 'true');
        detailsButton.textContent = detailsPanel.hidden ? 'Ver detalhes' : 'Ocultar detalhes';
      });
      driverActions.appendChild(detailsButton);
      tripExtraCard.appendChild(driverActions);
      tripExtraCard.appendChild(detailsPanel);
    }
    // A completed/payment-pending trip no longer has an assigned-trip action
    // card, but its route, price and driver are still important. Keep the
    // complete summary visible instead of leaving only the payment receipt.
    if ((showReceipt || showRating) && !paymentChoiceRequired) {
      var completedDetailsPanel = buildTripDetailsPanel(trip, payload);
      completedDetailsPanel.hidden = false;
      completedDetailsPanel.classList.add('sarca-trip-details--completed');
      tripExtraCard.appendChild(completedDetailsPanel);
    }
    if (reference) {
      tripExtraCard.appendChild(el('div', 'sarca-extra__line', '📍 Referência de recolha: ' + reference));
    }
    if (driverAssigned) renderTripPriceOffers(trip, payload);
    if (payload.progressWarning && payload.progressWarning.message) {
      var warning = el('div', 'sarca-extra__warning');
      warning.appendChild(el('div', '', '⚠️ ' + String(payload.progressWarning.message)));
      if (payload.progressWarning.canRequestReassignment) {
        var reassignment = el('button', '', 'Procurar outro motorista');
        reassignment.type = 'button';
        reassignment.addEventListener('click', function () {
          reassignment.disabled = true;
          reassignment.textContent = 'A procurar…';
          requestTripReassignment(trip.id, payload.progressWarning.code === 'driver_or_vehicle_mismatch' ? 'driver_or_vehicle_mismatch' : 'driver_not_progressing')
            .then(function () {
              reassignment.textContent = 'Pedido enviado';
              refreshTripTracking(trip.id);
            })
            .catch(function (error) {
              reassignment.disabled = false;
              reassignment.textContent = error && error.message ? error.message : 'Tentar novamente';
            });
        });
        warning.appendChild(reassignment);
      }
      tripExtraCard.appendChild(warning);
    }
    if (showHelp) {
      var helpActions = el('div', 'sarca-extra__actions');
      var help = el('button', 'is-danger', 'Não encontro o motorista');
      help.type = 'button';
      help.addEventListener('click', function () { showTripHelp(trip); });
      helpActions.appendChild(help);
      if (details) {
        var mismatch = el('button', 'is-danger', 'Viatura não corresponde');
        mismatch.type = 'button';
        mismatch.addEventListener('click', function () {
          openPassengerConfirmModal({
            title: 'Confirmar problema? ',
            message: 'O motorista ou a viatura não corresponde aos dados apresentados. Vamos informar a Central e proteger esta viagem.',
            cancelLabel: 'Voltar',
            confirmLabel: 'Informar a Central',
            onConfirm: function (close) {
              close();
              showTripMismatch(trip);
            },
          });
        });
        helpActions.appendChild(mismatch);
      }
      tripExtraCard.appendChild(helpActions);
    }
    if (status === 'driver_arriving' || status === 'driver_assigned') {
      var assistanceActions = el('div', 'sarca-extra__actions');
      var assistance = el('button', '', 'Preciso de assistência');
      assistance.type = 'button';
      assistance.title = 'Pedir ajuda à Central quando não encontrares o motorista ou precisares de apoio no embarque.';
      assistance.setAttribute('aria-label', 'Pedir assistência à Central');
      assistance.addEventListener('click', function () {
        assistance.disabled = true;
        assistance.textContent = 'A enviar pedido…';
        reportTripIncident(trip.id, 'boarding_assistance_requested').then(function () {
          assistance.textContent = 'Pedido enviado';
          tripExtraCard.appendChild(el('div', 'sarca-extra__notice', 'Pedido de assistência enviado à Central.'));
        }).catch(function () {
          assistance.disabled = false;
          assistance.textContent = 'Preciso de assistência';
          tripExtraCard.appendChild(el('div', 'sarca-extra__line', 'Não foi possível enviar. Verifica a ligação e tenta novamente.'));
        });
        window.dispatchEvent(new CustomEvent('sarCa:boarding-assistance', { detail: { tripId: trip.id } }));
      });
      assistanceActions.appendChild(assistance);
      tripExtraCard.appendChild(assistanceActions);
    }
    if (driverAssigned && (status === 'driver_assigned' || status === 'driver_arriving')) {
      appendTripCancellationControls(trip);
    }
    if (trip.destination_changed_at || trip.destinationChangedAt || trip.destination_change) {
      var change = trip.destination_change || {};
      var changedTotal = minorOrAmount(change, 'total_fare_minor', 'total_fare') || minorOrAmount(trip, 'final_fare_minor', 'final_fare');
      tripExtraCard.appendChild(el('div', 'sarca-extra__notice', 'Destino atualizado · novo total: ' + money(changedTotal)));
    }
    if (showReceipt) {
      var receipt = el('div', 'sarca-extra__receipt');
      receipt.appendChild(el('strong', '', 'Recibo claro'));
      var breakdown = trip.pricing_breakdown || {};
      var ride = minorOrAmount(trip, 'commissionable_fare_minor', 'commissionable_fare') || minorOrAmount(trip, 'final_fare_minor', 'final_fare');
      var toll = minorOrAmount(trip, 'toll_amount_minor', 'toll_amount');
      var waitFee = minorOrAmount(trip, 'wait_fee_minor', 'wait_fee');
      var totalFare = minorOrAmount(trip, 'final_fare_minor', 'final_fare') || ride + toll + waitFee;
      appendReceiptRow(receipt, 'Viagem', money(ride));
      appendReceiptRow(receipt, 'Portagens', money(toll));
      appendReceiptRow(receipt, 'Espera validada', money(waitFee));
      if (breakdown.discount || breakdown.discount_minor) appendReceiptRow(receipt, 'Desconto', money(minorOrAmount(breakdown, 'discount_minor', 'discount')));
      appendReceiptRow(receipt, 'Total', money(totalFare));
      if (toll > 0) {
        receipt.appendChild(el('div', 'sarca-extra__notice', 'Portagem de ' + money(toll) + ' já acrescentada automaticamente. O motorista recebe este valor por inteiro; não há comissão SARCA sobre a portagem.'));
      }
      var needsPaymentConfirmation = paymentChoiceRequired || (['payment_pending', 'completed'].includes(status) && paymentStatus !== 'settled');
      if (needsPaymentConfirmation) {
        var tollSuffix = toll > 0 ? ' + PORTAGEM' : '';
        var paymentChoiceState = el('div', 'sarca-extra__line', passengerWalletBalance == null
          ? 'A verificar saldo da carteira…'
          : 'Saldo da carteira: ' + money(passengerWalletBalance) + ' ' + passengerWalletCurrency);
        if (cashReceiptPending) {
          receipt.appendChild(el('strong', '', 'Confirma o pagamento em cash'));
          receipt.appendChild(el('div', 'sarca-extra__notice', 'Entrega o valor ao motorista e confirma aqui. O motorista não fica elegível para novo pedido até esta confirmação.'));
          paymentChoiceState.textContent = 'Pagamento escolhido: cash · falta confirmar a entrega do dinheiro.';
          receipt.appendChild(paymentChoiceState);
          var confirmCashButton = el('button', 'sarca-extra__primary-action', 'CONFIRMAR QUE PAGUEI EM CASH');
          confirmCashButton.type = 'button';
          confirmCashButton.addEventListener('click', function () {
            confirmCashButton.disabled = true;
            confirmCashButton.textContent = 'A confirmar…';
            paymentChoiceState.textContent = 'A concluir pagamento e a libertar o motorista…';
            confirmCashReceipt(trip.id).then(function () {
              rememberPassengerPaymentChoice(trip.id);
              ratingEligibleTripIds[String(trip.id || '')] = true;
              playPaymentSuccessEffect();
              showPassengerRatingAfterPayment(trip.id, 'cash');
            }).catch(function (error) {
              confirmCashButton.disabled = false;
              confirmCashButton.textContent = 'CONFIRMAR QUE PAGUEI EM CASH';
              paymentChoiceState.textContent = error && error.message ? error.message : 'Não foi possível concluir o pagamento em cash.';
            });
          });
          receipt.appendChild(confirmCashButton);
        } else {
          receipt.appendChild(el('strong', '', 'Como vais pagar?'));
          receipt.appendChild(el('div', 'sarca-extra__line', 'Escolhe uma opção para concluir o pagamento. A avaliação aparece depois da confirmação.'));
          receipt.appendChild(paymentChoiceState);
          var paymentActions = el('div', 'sarca-extra__actions');
          var cashButton = el('button', 'sarca-extra__primary-action', 'PAGAR COM CASH' + tollSuffix);
          var walletButton = el('button', 'sarca-extra__primary-action', 'PAGAR COM CARTEIRA' + tollSuffix);
          cashButton.type = 'button';
          walletButton.type = 'button';
          var cashLabel = 'PAGAR COM CASH' + tollSuffix;
          var walletLabel = 'PAGAR COM CARTEIRA' + tollSuffix;
          cashButton.textContent = cashLabel;
          walletButton.textContent = walletLabel;
          var setPaymentBusy = function (busy, label) {
            cashButton.disabled = busy;
            walletButton.disabled = busy;
            cashButton.textContent = busy ? 'A confirmar…' : cashLabel;
            walletButton.textContent = busy ? 'A confirmar…' : walletLabel;
            if (label) paymentChoiceState.textContent = label;
          };
          var markPaymentConfirmed = function () {
            cashButton.disabled = true;
            walletButton.disabled = true;
            cashButton.textContent = 'Pagamento confirmado';
            walletButton.textContent = 'Pagamento confirmado';
            paymentChoiceState.textContent = 'Pagamento confirmado · saldo do motorista atualizado.';
          };
          var choosePayment = function (method, button) {
            setPaymentBusy(true, 'A confirmar pagamento…');
            if (method === 'wallet') {
              var balancePromise = passengerWalletBalance == null
                ? fetchPassengerWalletBalance()
                : Promise.resolve(passengerWalletBalance);
              balancePromise.then(function (balance) {
                if (Number(balance) + 0.005 < Number(totalFare)) {
                  throw new Error('Saldo insuficiente na carteira. Disponível: ' + money(balance) + ' MZN; necessário: ' + money(totalFare) + ' MZN.');
                }
                return confirmTripPayment(trip.id, 'wallet');
              }).then(function () {
                rememberPassengerPaymentChoice(trip.id);
                ratingEligibleTripIds[String(trip.id || '')] = true;
                markPaymentConfirmed();
                playPaymentSuccessEffect();
                showPassengerRatingAfterPayment(trip.id, 'wallet');
              }).catch(function (error) {
                setPaymentBusy(false, error && error.message ? error.message : 'Saldo insuficiente ou não foi possível confirmar o pagamento.');
              });
              return;
            }
            confirmTripPayment(trip.id, 'cash').then(function (result) {
              if (result && result.awaiting_cash_receipt) {
                refreshTripTracking(trip.id);
                return;
              }
              // Some already-settled or free-trial cash trips return the final
              // settlement directly. In that case the passenger must see the
              // rating immediately instead of being sent back to the request
              // form or left with the old payment card.
              rememberPassengerPaymentChoice(trip.id);
              ratingEligibleTripIds[String(trip.id || '')] = true;
              markPaymentConfirmed();
              playPaymentSuccessEffect();
              showPassengerRatingAfterPayment(trip.id, 'cash');
            }).catch(function (error) {
              setPaymentBusy(false, error && error.message ? error.message : 'Não foi possível preparar o pagamento em cash.');
            });
          };
          cashButton.addEventListener('click', function () { choosePayment('cash', cashButton); });
          walletButton.addEventListener('click', function () { choosePayment('wallet', walletButton); });
          paymentActions.appendChild(cashButton);
          paymentActions.appendChild(walletButton);
          receipt.appendChild(paymentActions);
        }
        if (passengerWalletBalance == null) {
          fetchPassengerWalletBalance().then(function (balance) {
            paymentChoiceState.textContent = 'Saldo da carteira: ' + money(balance) + ' ' + passengerWalletCurrency;
          }).catch(function () {
            paymentChoiceState.textContent = 'Saldo da carteira indisponível. A escolha será validada com segurança no servidor.';
          });
        }
      }
      tripExtraCard.appendChild(receipt);
    }
    if (showRating) {
      var rating = el('div', 'sarca-extra__receipt');
      rating.appendChild(el('strong', '', 'Como foi a sua experiência?'));
      var stars = el('div', 'sarca-extra__stars');
      for (var index = 1; index <= 5; index++) {
        var star = el('button', '', '★');
        star.type = 'button';
        star.setAttribute('aria-label', index + ' estrelas');
        (function (value, button) {
          button.addEventListener('click', function () {
            Array.prototype.forEach.call(stars.children, function (item, itemIndex) { item.classList.toggle('is-selected', itemIndex < value); });
            submitTripRating(trip.id, value).then(function () {
              rememberPassengerRatedTrip(trip.id);
              window.dispatchEvent(new CustomEvent('sarCa:trip-rating-selected', { detail: { tripId: trip.id, rating: value } }));
              // The reward RPC can mark the event as presented before the
              // polling loop sees it. Refresh immediately so the passenger
              // receives the points animation in the same rating action.
              refreshRiderRewards();
              returnPassengerHomeAfterRating(trip.id);
            }).catch(function (error) {
              // A previous successful submission is authoritative. Treat the
              // duplicate response as completion so a stale card cannot trap
              // the passenger in an already-rated trip.
              if (isTripAlreadyRatedError(error)) {
                rememberPassengerRatedTrip(trip.id);
                window.dispatchEvent(new CustomEvent('sarCa:trip-rating-already-recorded', { detail: { tripId: trip.id } }));
                returnPassengerHomeAfterRating(trip.id);
                showRiderActionToast('Esta viagem já foi avaliada.');
                return;
              }
              rating.appendChild(el('div', 'sarca-extra__line', error && error.message ? error.message : 'Não foi possível guardar a avaliação.'));
            });
          });
        })(index, star);
        stars.appendChild(star);
      }
      rating.appendChild(stars);
      tripExtraCard.appendChild(rating);
    }
    tripExtraCard.classList.add('is-visible');
    syncPassengerCardLayout('extra');
  }

  function renderTripState(payload) {
    if (!tripStateCard || !payload || typeof payload !== 'object') return;
    var trip = payload.trip || null;
    if (!trip || typeof trip !== 'object') {
      // A realtime response can briefly omit a just-settled trip while the
      // payment webhook and tracking row converge. Do not erase the rating
      // card in that window: the passenger already confirmed payment and
      // must be able to rate the exact trip once, without returning to the
      // request form. The next authoritative response will replace this
      // optimistic snapshot.
      var pendingRatingId = pendingPassengerRatingId();
      var cachedTrip = lastTripPayload && lastTripPayload.trip;
      if (pendingRatingId && cachedTrip && String(cachedTrip.id || '') === pendingRatingId) {
        ratingEligibleTripIds[pendingRatingId] = true;
        var settledSnapshot = Object.assign({}, cachedTrip, {
          status: 'completed',
          payment_status: 'settled',
        });
        lastTripPayload = Object.assign({}, lastTripPayload, { trip: settledSnapshot, myRating: null });
        renderTripExtras(lastTripPayload);
        setTimeout(restorePendingPassengerRating, 0);
        return;
      }
      stopWaitDisplayTimer();
      cacheActivePassengerTrip(null);
      stopTripTrackingPolling();
      tripStateCard.classList.remove('is-visible');
      tripStateCard.classList.remove('is-accepted-hidden');
      tripStateCard.classList.remove('is-searching', 'is-assigned');
      if (tripExtraCard) tripExtraCard.classList.remove('is-visible');
      if (mapDashboardPanel) mapDashboardPanel.classList.remove('is-trip-active');
      passengerCameraTripKey = '';
      passengerCameraNeedsInitialFit = true;
      if (passengerCameraButton) passengerCameraButton.hidden = true;
      renderNearbyDrivers(lastNearbyDrivers, lastNearbyUpdatedAt);
      syncPassengerCardLayout('none');
      return;
    }
    var tripStatus = String(trip.status || '');
    if (dismissedCompletedTripId && String(trip.id || '') === dismissedCompletedTripId && ['completed', 'payment_pending'].includes(tripStatus)) {
      if (payload.myRating) {
        returnPassengerHomeAfterRating(trip.id);
        return;
      }
      dismissedCompletedTripId = '';
    }
    if (dismissedCompletedTripId && String(trip.id || '') !== dismissedCompletedTripId) {
      dismissedCompletedTripId = '';
    }
    var previousTrip = lastTripPayload && lastTripPayload.trip;
    var previousStatus = previousTrip && String(previousTrip.status || '').toLowerCase();
    var currentIsTerminal = ['completed', 'payment_pending'].includes(tripStatus);
    var previousWasActive = previousStatus && !['completed', 'payment_pending', 'cancelled', 'cancelled_by_driver', 'no_driver_found'].includes(previousStatus);
    if (previousTrip && String(previousTrip.id || '') === String(trip.id || '') && currentIsTerminal && previousWasActive) {
      ratingEligibleTripIds[String(trip.id || '')] = true;
    }
    if (previousTrip &&
        (String(previousTrip.id || '') !== String(trip.id || '') ||
         String(previousTrip.status || '') !== String(trip.status || ''))) {
      lastLiveRoute = null;
      liveRouteRequestAt = 0;
      passengerCameraNeedsInitialFit = true;
    }
    lastTripPayload = payload;
    var wait = payload.wait || null;
    syncWaitDisplayTimer(payload);
    var status = String(trip.status || '');
    if (status === 'completed' || status === 'payment_pending') {
      // Keep the finished trip cached until payment and rating are handled;
      // otherwise a reload can lose the payment choice card entirely.
      cacheActivePassengerTrip(payload);
      stopTripTrackingPolling();
      tripStateCard.classList.remove('is-visible');
      tripStateCard.classList.remove('is-accepted-hidden');
      tripStateCard.classList.remove('is-searching', 'is-assigned');
      if (paymentTollCard) paymentTollCard.classList.remove('is-visible');
      if (mapDashboardPanel) mapDashboardPanel.classList.remove('is-trip-active');
      passengerCameraTripKey = '';
      passengerCameraNeedsInitialFit = true;
      if (passengerCameraButton) passengerCameraButton.hidden = true;
      syncFullMapMapObjects();
      renderNearbyDrivers(lastNearbyDrivers, lastNearbyUpdatedAt);
      renderTripExtras(payload);
      return;
    }
    var progressState = String(trip.driver_progress_state || trip.driverProgressState || '').toLowerCase();
    var uiStatus = status === 'driver_assigned' && ['moving', 'en_route', 'heading_to_pickup'].includes(progressState) ? 'driver_arriving' : status;
    var state = tripStateLabel(uiStatus, wait);
    if (!state[0]) {
      cacheActivePassengerTrip(null);
      stopTripTrackingPolling();
      tripStateCard.classList.remove('is-visible');
      tripStateCard.classList.remove('is-searching', 'is-assigned');
      if (paymentTollCard) paymentTollCard.classList.remove('is-visible');
      if (mapDashboardPanel) mapDashboardPanel.classList.remove('is-trip-active');
      syncPassengerCardLayout('none');
      return;
    }
    // Depois de atribuído, os detalhes ficam no cartão compacto inferior.
    // Evita repetir no topo a mesma informação que o passageiro já vê no mapa.
    var acceptedStatuses = ['driver_assigned', 'driver_arriving', 'in_progress'];
    tripStateCard.classList.toggle('is-accepted-hidden', acceptedStatuses.indexOf(uiStatus) !== -1);
    tripStateCard.classList.toggle('is-searching', ['searching_driver', 'offered_to_driver'].indexOf(uiStatus) !== -1);
    tripStateCard.classList.toggle('is-assigned', acceptedStatuses.indexOf(uiStatus) !== -1);
    var activePanelStatuses = ['searching_driver', 'offered_to_driver', 'driver_assigned', 'driver_arriving', 'in_progress'];
    if (mapDashboardPanel) mapDashboardPanel.classList.toggle('is-trip-active', activePanelStatuses.indexOf(String(trip.status || '')) !== -1);
    cacheActivePassengerTrip(payload);
    tripStateCard.innerHTML = '';
    var top = el('div', 'sarca-trip-state__top');
    top.appendChild(el('span', 'sarca-trip-state__title', state[0]));
    top.appendChild(el('span', 'sarca-weather__updated', String(trip.service_label || trip.service_class || 'SARCA')));
    tripStateCard.appendChild(top);
    tripStateCard.appendChild(el('div', 'sarca-trip-state__meta', state[1]));
    var matching = payload.matching || null;
    var eligibleNearbyDrivers = matching && Number(matching.eligibleNearbyDrivers);
    if ((status === 'searching_driver' || status === 'offered_to_driver') && isFinite(eligibleNearbyDrivers) && eligibleNearbyDrivers > 0) {
      tripStateCard.appendChild(el('div', 'sarca-trip-state__meta', 'A contactar ' + Math.min(eligibleNearbyDrivers, 8) + ' motorista(s) ativo(s) perto da recolha.'));
    }
    if (status === 'searching_driver' || status === 'offered_to_driver') {
      var searchActions = el('div', 'sarca-extra__actions');
      var searchMessage = el('div', 'sarca-trip-state__meta', 'Podes cancelar enquanto procuramos.');
      var cancelSearch = el('button', 'is-danger', 'CANCELAR PROCURA');
      cancelSearch.type = 'button';
      cancelSearch.addEventListener('click', function () {
        cancelTripWhileSearching(trip.id, cancelSearch, searchMessage);
      });
      searchActions.appendChild(cancelSearch);
      searchActions.appendChild(searchMessage);
      tripStateCard.appendChild(searchActions);
    }
    var progress = el('div', 'sarca-trip-state__progress');
    var done = uiStatus === 'searching_driver' || uiStatus === 'offered_to_driver' ? 1 : uiStatus === 'driver_assigned' ? 2 : uiStatus === 'driver_arriving' ? 3 : uiStatus === 'in_progress' ? 4 : 5;
    for (var i = 0; i < 5; i++) {
      var bar = el('i', i < done ? 'is-done' : '');
      progress.appendChild(bar);
    }
    tripStateCard.appendChild(progress);
    var tripProgress = payload.tripProgress || {};
    var liveRouteProgress = tripProgress.liveRoute || lastLiveRoute;
    if (tripProgress || liveRouteProgress) {
      var elapsedMinutes = Number(tripProgress.elapsedMinutes);
      if (uiStatus === 'in_progress' && isFinite(elapsedMinutes)) {
        tripStateCard.appendChild(el('div', 'sarca-trip-state__meta', '⏱️ Tempo de viagem: ' + Math.max(0, Math.floor(elapsedMinutes)) + ' min'));
      }
      var remainingDistanceKm = tripProgress.remainingDistanceKm != null
        ? Number(tripProgress.remainingDistanceKm)
        : Number(liveRouteProgress && liveRouteProgress.distanceKm);
      var etaMinutesValue = tripProgress.etaMinutes != null
        ? Number(tripProgress.etaMinutes)
        : Number(liveRouteProgress && liveRouteProgress.durationSeconds) / 60;
      var hasRouteProgress = tripProgress.progressPercent != null || isFinite(remainingDistanceKm) || isFinite(etaMinutesValue);
      if (hasRouteProgress) {
        var numericProgress = Math.max(0, Math.min(100, Number(tripProgress.progressPercent || 0)));
        var distanceProgress = el('div', 'sarca-trip-state__distance-progress');
        var distanceFill = el('span');
        distanceFill.style.width = numericProgress + '%';
        distanceProgress.appendChild(distanceFill);
        tripStateCard.appendChild(distanceProgress);
        var progressText = isFinite(remainingDistanceKm) ? remainingDistanceKm.toFixed(1) + ' km restantes' : 'Percurso em atualização';
        if (isFinite(etaMinutesValue)) progressText += ' · cerca de ' + Math.max(0, Math.ceil(etaMinutesValue)) + ' min';
        tripStateCard.appendChild(el('div', 'sarca-trip-state__route-note', progressText + ' · mapa a acompanhar automaticamente'));
      } else if (uiStatus === 'in_progress') {
        tripStateCard.appendChild(el('div', 'sarca-trip-state__route-note', 'A atualizar distância e tempo da rota…'));
      }
      if (tripProgress.routeRecalculated) {
        tripStateCard.appendChild(el('div', 'sarca-trip-state__route-note', '↻ Rota atualizada pela posição atual do motorista.'));
      }
      var nextManeuver = tripProgress.nextManeuver || (liveRouteProgress && liveRouteProgress.nextManeuver);
      if (['driver_arriving', 'in_progress'].indexOf(uiStatus) !== -1 && nextManeuver) {
        var maneuverCard = el('div', 'sarCa-trip-state__maneuver');
        maneuverCard.appendChild(el('span', 'sarCa-trip-state__maneuver-icon', nextManeuver.icon || '↑'));
        maneuverCard.appendChild(el('span', '', maneuverDisplayText(nextManeuver)));
        tripStateCard.appendChild(maneuverCard);
      }
    }
    if (payload.boardingPin && payload.boardingPin.code && !payload.boardingPin.usedAt && status === 'driver_arriving') {
      tripStateCard.appendChild(el('div', 'sarca-trip-state__pin', 'PIN de embarque: ' + payload.boardingPin.code));
    }
    if (wait && ['active', 'paused'].includes(String(wait.state || ''))) {
      var waitCounter = el('div', 'sarca-trip-state__meta sarCa-wait-countdown');
      tripStateCard.appendChild(waitCounter);
      renderWaitCounter(wait);
    }
    var connectivity = navigator.onLine === false ? 'Sem internet · a manter a última posição conhecida.' : 'Ligação ativa · estados atualizados automaticamente.';
    tripStateCard.appendChild(el('div', 'sarca-trip-state__meta', connectivity));
    if (['driver_assigned', 'driver_arriving', 'in_progress'].indexOf(uiStatus) !== -1) {
      tripStateCard.appendChild(el('div', 'sarca-trip-state__route-note', driverLocationStatus(payload)));
    }
    var voiceControl = el('div', 'sarca-voice-control');
    voiceControl.appendChild(el('span', '', 'Anúncios da viagem')); 
    var voiceButton = el('button', '', '🔊 ' + voiceModeLabel());
    voiceButton.type = 'button';
    voiceButton.addEventListener('click', cycleVoiceMode);
    voiceControl.appendChild(voiceButton);
    tripStateCard.appendChild(voiceControl);
    tripStateCard.classList.add('is-visible');
    if (acceptedStatuses.indexOf(uiStatus) === -1) syncPassengerCardLayout('state');
    announceTripState(payload, trip, wait);
    renderTripExtras(payload);
    syncTripTrackingPolling(payload);
    requestMapFollow(payload);
    recalculateLiveRoute(payload);
  }

  function rewriteRequestBody(body, url) {
    if (typeof body !== 'string') return body;
    try {
      var json = JSON.parse(body);
      if (!json || typeof json !== 'object') return body;
      if (explicitPaymentChoice && ('paymentMethod' in json || 'payment_method' in json)) {
        json.paymentMethod = explicitPaymentChoice;
        delete json.payment_method;
      }
      if (pickupReference.trim() && url && url.indexOf('sarca-request-trip') !== -1) {
        json.pickupAccessPoint = {
          label: pickupReference.trim(),
          latitude: numberOrNull(json.pickupLat != null ? json.pickupLat : json.pickup_lat),
          longitude: numberOrNull(json.pickupLng != null ? json.pickupLng : json.pickup_lng),
          confirmed: true,
        };
      }
      if (url && url.indexOf('sarca-request-trip') !== -1) {
        json.pricingMode = negotiationChoice === 'negotiation' ? 'negotiation' : 'suggested';
        if (negotiationChoice === 'negotiation') {
          var proposed = Number(negotiationProposedFare);
          if (isFinite(proposed) && proposed > 0) json.proposedFare = proposed;
        } else {
          delete json.proposedFare;
          delete json.proposedFareMinor;
        }
      }
      if (lastCurrentLocation && url && (url.indexOf('preview-trip-offers') !== -1 || url.indexOf('sarca-request-trip') !== -1)) {
        var pickupLat = json.pickupLat != null ? json.pickupLat : json.pickup_lat;
        var pickupLng = json.pickupLng != null ? json.pickupLng : json.pickup_lng;
        if (pickupUsesCurrentLocation || !isFinite(Number(pickupLat)) || !isFinite(Number(pickupLng))) {
          json.pickupLat = lastCurrentLocation.latitude;
          json.pickupLng = lastCurrentLocation.longitude;
          json.pickup_lat = lastCurrentLocation.latitude;
          json.pickup_lng = lastCurrentLocation.longitude;
        }
        var pickupAddress = String(json.pickupAddress || json.pickup_address || '').trim();
        if (!pickupAddress || /minha localização atual|a tua localização|localiza[cç][aã]o atual/i.test(pickupAddress)) json.pickupAddress = lastCurrentLocation.label;
      }
      if (lastDestinationSelection && url && (url.indexOf('preview-trip-offers') !== -1 || url.indexOf('sarca-request-trip') !== -1)) {
        var destinationLat = json.destinationLat != null ? json.destinationLat : json.destination_lat;
        var destinationLng = json.destinationLng != null ? json.destinationLng : json.destination_lng;
        if (!isFinite(Number(destinationLat)) || !isFinite(Number(destinationLng))) {
          json.destinationLat = lastDestinationSelection.latitude;
          json.destinationLng = lastDestinationSelection.longitude;
          if ('destination_lat' in json) json.destination_lat = lastDestinationSelection.latitude;
          if ('destination_lng' in json) json.destination_lng = lastDestinationSelection.longitude;
        }
        var destinationAddress = String(json.destinationAddress || json.destination_address || '').trim();
        if (!destinationAddress || /para onde|destino/i.test(destinationAddress)) json.destinationAddress = lastDestinationSelection.label;
        if (lastDestinationSelection.routePoints && lastDestinationSelection.routePoints.length >= 2) {
          if (!Array.isArray(json.routePoints) || json.routePoints.length < 2) json.routePoints = lastDestinationSelection.routePoints;
          if (!isFinite(Number(json.distanceKm)) && isFinite(Number(lastDestinationSelection.distanceKm))) json.distanceKm = lastDestinationSelection.distanceKm;
          if (!isFinite(Number(json.durationSeconds)) && isFinite(Number(lastDestinationSelection.durationSeconds))) json.durationSeconds = lastDestinationSelection.durationSeconds;
        }
      }
      return JSON.stringify(json);
    } catch (_) {}
    return body;
  }

  function handleTripResponse(url, payload, expectedTripId) {
    if (!url || !payload || typeof payload !== 'object') return;
    var incomingTrip = payload.trip && typeof payload.trip === 'object' ? payload.trip : null;
    var incomingTripId = incomingTrip && String(incomingTrip.id || incomingTrip.trip_id || '');
    if (expectedTripId && incomingTripId && incomingTripId !== String(expectedTripId)) return;
    // Never let a late response from an older request repaint the current
    // request. A new request is accepted only after the previous one has
    // reached a terminal state and its UI has been reset.
    var currentTrip = lastTripPayload && lastTripPayload.trip;
    var currentTripId = currentTrip && String(currentTrip.id || currentTrip.trip_id || '');
    var activeStatuses = ['searching_driver', 'offered_to_driver', 'driver_assigned', 'driver_arriving', 'in_progress'];
    if (incomingTripId && currentTripId && incomingTripId !== currentTripId &&
        activeStatuses.indexOf(String(currentTrip.status || '')) !== -1 &&
        activeStatuses.indexOf(String(incomingTrip.status || '')) !== -1) return;
    if (url.indexOf('preview-trip-offers') !== -1) {
      lastPreviewPayload = payload;
      // The preload is only for showing the four category prices. The
      // negotiation/payment card must wait until the passenger chooses one.
      if (mapDashboardServiceClass) renderPaymentToll(payload);
    }
    if (url.indexOf('sarca-request-trip') !== -1) {
      if (payload.error && !payload.trip) {
        if (paymentTollCard) paymentTollCard.classList.add('is-visible');
        syncPassengerCardLayout('payment');
        appendPaymentError(String(payload.error));
        return;
      }
      renderPaymentToll(payload);
      // The request endpoint already dispatches to nearby active drivers. Move
      // the rider into the live search state immediately instead of leaving
      // the confirmation card visible until the first polling response.
      if (payload.trip) renderTripState(payload);
    }
    if (url.indexOf('trip-live-tracking') !== -1 || url.indexOf('sarca-progress-trip') !== -1) {
      renderTripState(payload);
      var terminalStatus = String(incomingTrip && incomingTrip.status || '').toLowerCase();
      if (['completed', 'payment_pending'].indexOf(terminalStatus) !== -1 && incomingTripId) {
        scheduleRiderCompletionRefresh(incomingTripId);
      }
    }
  }

  function installTripNetworkBridge() {
    if (window.__sarcaTripNetworkBridge) return;
    window.__sarcaTripNetworkBridge = true;
    var originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
      window.fetch = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        var nextInit = init ? Object.assign({}, init) : init;
        captureAuthHeader(input, nextInit);
        capturePreviewRequestFromInput(input, nextInit, url);
        if (nextInit && nextInit.body) {
          nextInit.body = rewriteRequestBody(nextInit.body, url);
        }
        return originalFetch.call(this, input, nextInit).then(function (response) {
          response.clone().json().then(function (payload) { handleTripResponse(url, payload); }).catch(function () {});
          return response;
        });
      };
    }
    var xhrOpen = XMLHttpRequest.prototype.open;
    var xhrSend = XMLHttpRequest.prototype.send;
    var xhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__sarcaUrl = String(url || '');
      return xhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      if (xhr.__sarcaUrl && (xhr.__sarcaUrl.indexOf('preview-trip-offers') !== -1 || xhr.__sarcaUrl.indexOf('sarca-request-trip') !== -1 || xhr.__sarcaUrl.indexOf('trip-live-tracking') !== -1 || xhr.__sarcaUrl.indexOf('sarca-progress-trip') !== -1)) {
        xhr.addEventListener('load', function () {
          try { handleTripResponse(xhr.__sarcaUrl, JSON.parse(xhr.responseText)); } catch (_) {}
        }, { once: true });
        if (xhr.__sarcaUrl.indexOf('preview-trip-offers') !== -1) capturePreviewRequest(body);
        body = rewriteRequestBody(body, xhr.__sarcaUrl);
      }
      return xhrSend.call(this, body);
    };
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (String(name || '').toLowerCase() === 'authorization') {
        var authorization = String(value || '');
        if (authorization.trim() !== 'Bearer ' + String(SARCA_SUPABASE_KEY || '').trim() && !/^Bearer\s+sb_publishable_/i.test(authorization)) lastAuthHeader = authorization;
      }
      return xhrSetRequestHeader.apply(this, arguments);
    };
  }

  function dismissRiderLoader() {
    var loader = document.getElementById('sarca-loader');
    if (!loader) return;
    loader.classList.add('is-hidden');
    window.setTimeout(function () {
      if (loader && loader.parentNode) loader.remove();
    }, 320);
  }

  function bootProtected() {
    // This one-shot route is used after an explicit logout so the original
    // phone/password auth flow is shown instead of the map guest shell.
    installCompactUi();
    installPointsRewardStyles();
    // Capture the restored Supabase session before the shell requests profile
    // and active-trip data. This makes refresh restoration automatic.
    installTripNetworkBridge();
    installFullMapSurface();
    installMapDashboardShell();
    // The authenticated shell is already visible at this point. Do not leave
    // the large login-preparation overlay over the map while location and
    // trip data continue loading in the background.
    dismissRiderLoader();
    // Android asks natively at startup. On the Web, browsers generally allow
    // this prompt only after a user gesture; keep the bell-click fallback and
    // also try once after the authenticated shell is visible.
    setTimeout(function () {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(function () {});
      }
    }, 1200);
    document.querySelectorAll('#sarca-weather-card, .sarca-rain-layer, .sarca-heat-dialog').forEach(function (node) { node.remove(); });
    loadVoiceMode();
    refreshRiderPoints();
    refreshRiderRewards();
    startRiderRewardsPolling();
    installNearbyDriversCard();
    installDestinationSearch();
    installPaymentTollCard();
    tripStateCard = el('section', 'sarca-trip-state-card');
    tripStateCard.id = 'sarca-trip-state-card';
    document.body.appendChild(tripStateCard);
    tripExtraCard = el('section', 'sarca-trip-extra-card');
    tripExtraCard.id = 'sarca-trip-extra-card';
    document.body.appendChild(tripExtraCard);
    setTimeout(restorePendingPassengerRating, 700);
    restoreCachedPassengerTrip();
    // Restore an active trip after a reload or when the rider opens the app
    // after the driver has already accepted the request.
    setTimeout(restoreActivePassengerTrip, 900);
    setTimeout(restoreActivePassengerTrip, 2600);
    setTimeout(restoreLatestPassengerRating, 3400);
    activePassengerTripRestoreTimer = setInterval(function () {
      if (lastTripPayload && lastTripPayload.trip) {
        clearInterval(activePassengerTripRestoreTimer);
        activePassengerTripRestoreTimer = null;
        return;
      }
      restoreActivePassengerTrip();
    }, 5000);
    if (lastCurrentLocation) {
      startRiderLocationPublishing();
      startNearbyDriversPolling();
    }
    setTheme(); setRain(false);
    requestLocation();
    window.addEventListener('online', function () {
      refreshRiderPoints();
      refreshRiderRewards();
      if (lastTripPayload) {
        renderTripState(lastTripPayload);
        if (lastTripPayload.trip && lastTripPayload.trip.id) refreshTripTracking(lastTripPayload.trip.id);
      }
      restoreActivePassengerTrip();
    });
    window.addEventListener('offline', function () { if (lastTripPayload) renderTripState(lastTripPayload); });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      refreshRiderPoints();
      refreshRiderRewards();
      if (lastTripPayload && lastTripPayload.trip && lastTripPayload.trip.id) {
        refreshTripTracking(lastTripPayload.trip.id);
      } else {
        restoreActivePassengerTrip();
      }
    });
    setInterval(setTheme, 60000);
  }

  function clearRiderAuthStorage() {
    try {
      var clearSessionKey = function (key) {
        return /auth-token|supabase|rider-mobile-session|sarCa-demo-auth|sarCa-auth-session/i.test(key);
      };
      Object.keys(localStorage).filter(clearSessionKey).forEach(function (key) { localStorage.removeItem(key); });
      Object.keys(sessionStorage).filter(clearSessionKey).forEach(function (key) { sessionStorage.removeItem(key); });
    } catch (_) {}
    lastAuthHeader = null;
  }

  function redirectPassengerToLogin() {
    clearRiderAuthStorage();
    window.location.replace(window.location.pathname + '?sarCa-original=1&build=20261108-rider-session-required');
  }

  function boot() {
    // The map shell is a protected passenger area. The original Flutter auth
    // screen is the only public entry point; never render the map as a guest.
    var originalAuthRoute = false;
    try {
      originalAuthRoute = new URLSearchParams(window.location.search).get('sarCa-original') === '1';
    } catch (_) {}
    if (originalAuthRoute) {
      watchForMapShellAfterLogin();
      return;
    }

    var storedSessionHeader = loadStoredAuthHeader();
    getAuthenticatedAuthHeader().then(function (authorization) {
      // If the network is temporarily unavailable, a stored access token is
      // still an existing local session. It may restore the shell offline;
      // an online invalid/expired token is rejected and sent to login.
      if (!authorization && !(navigator.onLine === false && storedSessionHeader)) {
        redirectPassengerToLogin();
        return;
      }
      bootProtected();
    }).catch(function () {
      if (navigator.onLine === false && storedSessionHeader) {
        bootProtected();
        return;
      }
      redirectPassengerToLogin();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
