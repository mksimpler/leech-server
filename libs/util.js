'use strict';

const uuidv4 = require('uuid/v4');
const uuidv5 = require('uuid/v5');

const clone = require('clone');
const cache = require('../config/cache.js');

const fs = require('fs');

const {
    SearchResult,
    HumanInfo,
    MovieInfo
} = require('../models/types.js');

const stringSimilarity = require('string-similarity');

function formatText (str) {
    return str.replace(/\s\s+/g, ' ').trim();
}

module.exports.formatText = formatText;


function wrapText (val, maxLength) {
    if (!maxLength) {
        maxLength = 100;
    }
    if (val.length < maxLength) {
        return val;
    }
    return val.substring(0, maxLength - 3) + '...';
    //return val;
}

module.exports.wrapText = wrapText;


function formatProperCase (val) {
    var res = [];
    val.split(' ').forEach(v => {
        v = v.toLowerCase();
        res.push(
            v.replace(v.charAt(0), v.charAt(0).toUpperCase())
        );
    });
    return res.join(' ');
}

module.exports.formatProperCase = formatProperCase;


function replaceAll (s, oldS, newS) {
    return (s || "").split(oldS).join(newS);
}

module.exports.replaceAll = replaceAll;


function format (s) {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
        args[i] = arguments[i];
    }
    args = args.slice(1);

    var res = s;
    for (var i=0; i<args.length; i++) {
        res = replaceAll(res, '{' + i + '}', args[i]);
    }

    return res;
}

module.exports.format = format;


function split (s, delimiters) {
    if (typeof delimiters == 'string') {
        return s.split(delimiters);
    } else if (delimiters instanceof Array) {
        return s.split(new RegExp(delimiters.join('|'), 'g'))
            .filter(v => v);
    }
}

module.exports.split = split;


function genId (seedValue) {
    if (seedValue) {
        return uuidv5(seedValue + '', uuidv5.URL)
    } else {
        return uuidv4();
    }
}

module.exports.genId = genId;


function cacheImageURLs (data) {
    function cacheImage(id, obj) {
        cache.set('image', id, obj, 1800); // 30 minutes
    }

    let d = clone(data);

    if (d instanceof HumanInfo) {
        for (var i=0; i<d.photos.length; i++) {
            let obj = d.photos[i];
            let id = genId(obj.url) + '.jpg';
            cacheImage(id, obj)

            d.photos[i] = '/images/' + id;
        }

        return d;
    }

    else if (d instanceof MovieInfo) {
        for (var i=0; i<d.posters.length; i++) {
            let obj = d.posters[i];
            let id = genId(obj.url) + '.jpg';
            cacheImage(id, obj)

            d.posters[i] = '/images/' + id;
        }

        for (var i=0; i<d.screenshots.length; i++) {
            let obj = d.screenshots[i];
            let id = genId(obj.url) + '.jpg';
            cacheImage(id, obj)

            d.screenshots[i] = '/images/' + id;
        }

        for (var i=0; i<d.covers.length; i++) {
            let obj = d.covers[i];
            let id = genId(obj.url) + '.jpg';
            cacheImage(id, obj)

            d.covers[i] = '/images/' + id;
        }

        for (var i=0; i<d.thumb.length; i++) {
            let obj = d.thumb[i];
            let id = genId(obj.url) + '.jpg';
            cacheImage(id, obj)

            d.thumb[i] = '/images/' + id;
        }

        return d;
    }

    else if (d instanceof SearchResult) {
        let results = [];
        d.results.forEach(r => {
            let r_cached = cacheImageURLs(r);
            results.push(r_cached);
        });
        d.results = results;

        return d;
    }

    else {
        return null;
    }
}

module.exports.cacheImageURLs = cacheImageURLs;


function cacheURLs (data) {
    let d = clone(data);

    if (d instanceof SearchResult) {
        for (var i=0; i<d.results.length; i++) {
            let obj = d.results[i];
            let footprint = d.getFootprint(obj);
            let id = genId(JSON.stringify(footprint));

            cache.set('id', id, footprint, 3600); // 1 hour
            d.results[i].url = id;
        }

        return d;
    }

    else {
        return null;
    }
}

module.exports.cacheURLs = cacheURLs;


function tryGetMovId (val, sample) {
    val = val.toLowerCase();
    sample = (sample || "").toLowerCase();

    val = replaceAll(val, '-', '');
    sample = replaceAll(sample, '-', '');

    if (val.indexOf('h_') == 0) {
        val = val.substring(2);

        if (val == sample) {
            return val;
        }
    }

    let len = val.length;
    let startpos = 0;
    let endpos = 0;

    for (var i=0; i<len; i++) {
        let nan = isNaN(val.charAt(i));
        if (nan) {
            startpos = i;
            break;
        }
    }

    for (var i=len-1; i>-1; i--) {
        let nan = isNaN(val.charAt(i));
        if (!nan) {
            endpos = i;
            break;
        }
    }

    val = val.substring(startpos, endpos+1);
    if (val == sample) {
        return val;
    }

    len = val.length;
    startpos = -1;

    for (var i=0; i<len; i++) {
        let nan = isNaN(val.charAt(i));
        if (!nan) {
            startpos = i;
            break;
        }
    }

    if (startpos > -1) {
        while (val.charAt(startpos) == '0') {
            val = val.replace('0', '')
            if (val == sample) {
                return val;
            }
        }
    }

    return val;
}

module.exports.tryGetMovId = tryGetMovId;

function compareString (s1, s2) {
    return replaceAll(s1, '-', '').toLowerCase() == replaceAll(s2, '-', '').toLowerCase();
}

module.exports.compareString = compareString;

function compareStringSimilarity (s1, s2) {
    return stringSimilarity.compareTwoStrings(s1.toLowerCase(), s2.toLowerCase());
}

module.exports.compareStringSimilarity = compareStringSimilarity;

function syncObjects (des, src, overwrite) {
    if (!des) {
        throw new Error('Invalid Arguments');
    }

    if (!src) {
        return des;
    }

    if (typeof des !== typeof src ||
        typeof des !== 'object' ||
        Array.isArray(des)) {
        throw new Error('Invalid Arguements Type');
    }

    for (var key in des) {
        var p_des = des[key];
        var p_src = src[key];

        if (Array.isArray(p_des)) {
            if (p_des.length == 0 && Array.isArray(p_src) && p_src.length > 0) {
                des[key] = p_src;
            }
        } else if (typeof p_des === 'object' && p_des && typeof p_src === 'object' && p_src) {
            try {
                des[key] = syncObjects(p_des, p_src);
            }
            catch (ex) {
                console.error(ex);
            }
        } else if (!p_des) {
            if (p_src) des[key] = p_src;
        }
    }

    return des;
}

module.exports.syncObjects = syncObjects;


function catchURLError (url, err, resolve, reject) {
    var mss = err.message;
    if (mss.indexOf('HTTP Code') >= 0) {
        console.log('<' + mss + '> at ' + url)
        resolve(null);
    } else {
        reject(err);
    }
}

module.exports.catchURLError = catchURLError;

function toFile (content) {
    return fs.writeFileSync("result.txt", content, "utf8");
}

module.exports.toFile = toFile;
