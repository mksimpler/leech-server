'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('url');

const httpRequest = require('request');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

const sanitize = require("sanitize-filename");

const GET = 'GET';

const POST = 'POST';

const HEADERS = {
    "User-Agent":                "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:55.0) Gecko/20100101 Firefox/55.0",
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language":           "vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3",
    //"Accept-Encoding":           "gzip, deflate, br",
    "Connection":                "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Pragma":                    "no-cache",
    "Cache-control":             "no-cache",
}

var PROXY = "";

function formatFilename (filename) {
    if (filename === '') {
        return '';
    }

    var name = filename.substring(0, filename.lastIndexOf('.'));
    var ext = path.extname(filename);
    var i = ext.indexOf('?')
    if (i > 0) {
        filename = name + ext.substring(0, i);
    }

    return sanitize(filename, {
        replacement: "_"
    });
}

function enableProxy (proxyURL) {

    if (typeof proxyURL === 'string' && proxyURL != '') {
        PROXY = proxyURL
    } else {
        PROXY = "http://127.0.0.1:9666";
    }
}

function disableProxy () {
    PROXY = "";
}

module.exports.config = {};
module.exports.config.enableProxy = enableProxy;
module.exports.config.disableProxy = disableProxy;


function prepare (args) {
    let reqObj = {
        headers: {},
        jar: true,
    };

    let prcObj = {
        charset: null,
        target: null,
    };

    if (PROXY !== "" && typeof PROXY == 'string') {
        reqObj.proxy = PROXY;
    }

    for (let key in args) {
        if (key in prcObj) {
            prcObj[key] = args[key];
        } else {
            reqObj[key] = args[key];
        }
    }

    // Apply headers
    for (let key in HEADERS) {
        reqObj.headers[key] = HEADERS[key];
    }

    if (args['cookie']) {
        reqObj.headers['Cookie'] = httpRequest.cookie(args['cookie']);
    }

    return {
        "request": reqObj,
        "process": prcObj,
    };
}

function loadBody (body, response) {
    var $ = cheerio.load(body, { decodeEntities: false });
    $.response = response;
    $.getCurrentURL = function () {
        return this.response.request.uri['href'];
    }

    return $;
}

function findEncoding (res, body) {
    let charset = "";

    if (!charset) {
        charset = (function getCharSet(contentType) {
            var i = contentType.indexOf("charset=");
            if (i > -1) {
                return contentType.substring(i + "charset=".length, contentType.length);
            }
            else {
                return null;
            }

        })(res.headers["content-type"]);
    }

    if (!charset) {
        var startpos = body.indexOf('<meta charset="');
        var endpos = body.indexOf('">', startpos);
        if (startpos > -1 && endpos > startpos) {
            charset = body.substring(
                startpos + '<meta charset="'.length,
                endpos
            );
        }
    }

    if (!charset) {
        var startpos = body.indexOf('<meta http-equiv="Content-Type" content="text/html; charset=');
        var endpos = body.indexOf('">', startpos);
        if (startpos > -1 && endpos > startpos) {
            charset = body.substring(
                startpos + '<meta http-equiv="Content-Type" content="text/html; charset='.length,
                endpos
            );
        }
    }

    return charset;
}

function request (args, callback) {

    let fn = (err, data) => {
        if (err) throw err;
        return data;
    }

    if (callback) {
        fn = callback;
    }

    let requestArgs = args["request"];

    try {
        httpRequest(requestArgs, (err, res, body) => {

            if (err) {
                return fn(err, null);
            }

            if (res.statusCode !== 200) {
                //return fn(new Error("HTTP Code " + res.statusCode), null);
                return fn(new Error(`HTTP Code ${res.statusCode}. Url: ${requestArgs.url}`), null);
            }

            let charset = args["process"].charset;

            if (!charset) {
                charset = findEncoding(res, iconv.decode(body, "utf8")) || "utf8";
            }

            fn(null, { res: res, body: iconv.decode(body, charset) });
        })
    } catch (ex) {
        fn(ex, null);
    }
}

function get (options, callback) {
    let args = {};

    if (typeof options == 'string') {
        args = prepare({
            url: options,
            method: GET,
            encoding: null,
        });
    }

    else if (typeof options == 'object') {
        options["url"] = options["url"] || '';
        options["method"] = GET;
        options["encoding"] = null;
        args = prepare(options);
    }

    let fn = (err, data) => {
        if (err) throw err;
        return data;
    }

    if (callback) {
        fn = callback;
    }

    request(args, (err, data) => {

        if (err) {
            return fn(err, null);
        }

        let res = data.res;
        let body = data.body;

        try {
            var $ = loadBody(body, res);
            return fn(null, $);
        } catch (ex) {
            return fn(ex, null);
        }
    })
}

module.exports.get = get;


function post (options, callback) {
    options["json"] = options["json"] || false;
    options["form"] = options["url"] || {};
    options["body"] = options["url"] || {};
    options["url"] = options["url"] || '';
    options["method"] = POST;
    options["encoding"] = null;

    let args = prepare(options);

    let fn = (err, data) => {
        if (err) throw err;
        return data;
    }

    if (callback) {
        fn = callback;
    }

    request(args, (err, data) => {

        if (err) {
            return fn(err, null);
        }

        let res = data.res;
        let body = data.body;

        try {
            var $ = loadBody(body, res);
            return fn(null, $);
        } catch (ex) {
            return fn(ex, null);
        }
    })
}

module.exports.post = post;


function retrieve (url, location, callback) {

    if (!callback) {
        callback = err => {
            if (err) throw err;
        }
    }

    fs.exists(location, exist1 => {

        if (exist1) {
            var parsedUrl = parse(url)
            , tmp = parsedUrl.path.split('/')
            , filename = formatFilename(tmp[tmp.length - 1]);

            var filepath = path.join(location, filename);

            fs.exists(filepath, exist2 => {

                if (exist2) {
                    return callback(new Error('File existed: ' + filepath));
                } else {

                    var requestOpt = prepare({
                        url: url
                    })["request"];

                    try {
                        httpRequest(requestOpt)
                            .pipe(fs.createWriteStream(filepath))
                            .on('finish', () => callback(null))
                            .on('error', err => callback(err));
                    } catch (ex) {
                        callback(ex);
                    }
                }
            });
        } else {
            return callback(new Error('Location is not exist: ' + location));
        }
    });
}

module.exports.retrieve = retrieve;


function pipe (options, callback) {
    options["url"] = options["url"] || '';
    options["target"] = options["target"] || null;
    options["method"] = GET;

    let args = prepare(options);

    let fn = err => {
        if (err) throw err;
    }

    if (callback) {
        fn = callback;
    }

    try {
        httpRequest(args["request"])
            .on('response', function(res) {
                if (options['content-type']) {
                    res.headers['content-type'] = options['content-type']
                }
            })
            .on('error', function(err) {
                fn(err);
            })
            .pipe(args["process"].target)
            .on('finish', () => fn(null))
            .on('error', err => fn(err));
    } catch (ex) {
        fn(ex);
    }
}

module.exports.pipe = pipe;
