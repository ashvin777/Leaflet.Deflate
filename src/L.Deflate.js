L.Deflate = function(options) {
    var removedPaths = [];
    var minSize = options.minSize || 10;
    var markers, layer, map;
    var zoomBins = {};
    var startZoom;

    function isCollapsed(path, zoom) {
        var bounds = path.getBounds();

        var ne_px = map.project(bounds.getNorthEast(), zoom);
        var sw_px = map.project(bounds.getSouthWest(), zoom);

        var width = ne_px.x - sw_px.x;
        var height = sw_px.y - ne_px.y;
        return (height < minSize || width < minSize);
    }

    function getZoomThreshold(path) {
        var zoomThreshold = null;
        var zoom = map.getZoom();
        if (isCollapsed(path, map.getZoom())) {
            while (!zoomThreshold) {
                zoom += 1;
                if (!isCollapsed(path, zoom)) {
                    zoomThreshold = zoom - 1;
                }
            }
        } else {
            while (!zoomThreshold) {
                zoom -= 1;
                if (isCollapsed(path, zoom)) {
                    zoomThreshold = zoom;
                }
            }
        }
        return zoomThreshold;
    }

    function layeradd(event) {
        var feature = event.layer;
        if (feature instanceof L.Marker && layer !== markers) {
            layer.removeLayer(feature);
            markers.addLayer(feature);
        } else if (!feature._layers && feature.getBounds && !feature.zoomThreshold && !feature.marker) {
            var zoomThreshold = getZoomThreshold(feature);
            var marker = L.marker(feature.getBounds().getCenter());

            if (feature._popupHandlersAdded) {
                marker.bindPopup(feature._popup._content)
            }

            var events = feature._events;
            for (var event in events) {
                if (events.hasOwnProperty(event)) {
                    var listeners = events[event];
                    for (var i = 0, len = listeners.length; i < len; i++) {
                        marker.on(event, listeners[i].fn) 
                    }
                }
            }

            feature.zoomThreshold = zoomThreshold;
            feature.marker = marker;
            feature.setStyle({'color': '#3388ff'})

            if (layer !== markers) {
                layer.removeLayer(feature);
                markers.addLayer(feature);
            }
            
            if (map.getZoom() <= zoomThreshold) {
                markers.removeLayer(feature);
                markers.addLayer(feature.marker);
            }

            if (zoomBins[zoomThreshold]) {
                zoomBins[zoomThreshold].push(feature);
            } else {
                zoomBins[zoomThreshold] = [feature];
            }
        }
    }

    function zoomstart() {
        startZoom = map.getZoom();
    }

    function zoomend() {
        var bounds = map.getBounds();
        var startTime = Date.now();
        var endZoom = map.getZoom();
        var show = startZoom < endZoom;
        var layersToAdd = [];
        var layersToRemove = [];

        var processed = 0;
        var start = (show ? startZoom : endZoom);
        var end = (show ? endZoom : startZoom);
        for (var i = start; i <= end; i++) {
            if (zoomBins[i]) {
                var features = zoomBins[i];
                processed += features.length;

                for (var j = 0, len = features.length; j < len; j++) {
                    if (features[j].getBounds().overlaps(bounds)) {
                        if (show) {
                            layersToRemove.push(features[j].marker);
                            layersToAdd.push(features[j]);
                        } else {
                            layersToRemove.push(features[j]);
                            layersToAdd.push(features[j].marker);
                        }
                    }
                }
            }
        }
        markers.removeLayers(layersToRemove);
        markers.addLayers(layersToAdd);
        var endTime = Date.now();
        console.log(startZoom + '-->' + endZoom + ': ' + (endTime - startTime))
        console.log(startZoom + '-->' + endZoom + ': ' + processed)
        console.log('########################################################')
    }

    function addTo(addToMap) {
        map = addToMap;
        markers = layer = options.featureGroup || addToMap;
        if (options.cluster) {
            markers = L.markerClusterGroup();
            map.addLayer(markers);
        }
        if (layer !== map) {
            layer.on('layerremove', function() {
                map.removeLayer(layer);
                if (markers !== layer) {
                    map.removeLayer(markers);
                }
            });
        }

        layer.on('layeradd', layeradd);
        map.on('zoomstart', zoomstart);
        map.on('zoomend', zoomend);
    }

    return { addTo: addTo }
}
