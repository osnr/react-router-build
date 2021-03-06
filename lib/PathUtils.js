/* jshint -W084 */
'use strict';

var invariant = require('react/lib/invariant');
var assign = require('object-assign');
var qs = require('qs');

var queryMatcher = /\?([\s\S]*)$/;

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function _compilePattern(pattern) {
  var escapedSource = '';
  var paramNames = [];
  var tokens = [];

  var match,
      lastIndex = 0,
      matcher = /:([a-zA-Z_$][a-zA-Z0-9_$]*)|\*|\(|\)/g;
  while (match = matcher.exec(pattern)) {
    if (match.index !== lastIndex) {
      tokens.push(pattern.slice(lastIndex, match.index));
      escapedSource += escapeRegExp(pattern.slice(lastIndex, match.index));
    }

    if (match[1]) {
      escapedSource += '([^/?#]+)';
      paramNames.push(match[1]);
    } else if (match[0] === '*') {
      escapedSource += '([\\s\\S]*?)';
      paramNames.push('splat');
    } else if (match[0] === '(') {
      escapedSource += '(?:';
    } else if (match[0] === ')') {
      escapedSource += ')?';
    }

    tokens.push(match[0]);

    lastIndex = matcher.lastIndex;
  }

  if (lastIndex !== pattern.length) {
    tokens.push(pattern.slice(lastIndex, pattern.length));
    escapedSource += escapeRegExp(pattern.slice(lastIndex, pattern.length));
  }

  return {
    pattern: pattern,
    escapedSource: escapedSource,
    paramNames: paramNames,
    tokens: tokens
  };
}

var _compiledPatterns = {};

function compilePattern(pattern) {
  if (!(pattern in _compiledPatterns)) _compiledPatterns[pattern] = _compilePattern(pattern);

  return _compiledPatterns[pattern];
}

var PathUtils = {

  /**
   * Returns true if the given path is absolute.
   */
  isAbsolute: function isAbsolute(path) {
    return path.charAt(0) === '/';
  },

  /**
   * Joins two URL paths together.
   */
  join: function join(a, b) {
    return a.replace(/\/*$/, '/') + b;
  },

  /**
   * Returns an array of the names of all parameters in the given pattern.
   */
  extractParamNames: function extractParamNames(pattern) {
    return compilePattern(pattern).paramNames;
  },

  /**
   * Extracts the portions of the given URL path that match the given pattern
   * and returns an object of param name => value pairs. Returns null if the
   * pattern does not match the given path.
   */
  extractParams: function extractParams(pattern, path) {
    var _compilePattern2 = compilePattern(pattern);

    var escapedSource = _compilePattern2.escapedSource;
    var paramNames = _compilePattern2.paramNames;

    var matcher = new RegExp('^' + escapedSource + '$', 'i');
    var match = path.match(matcher);

    if (!match) return null;

    var params = {};

    paramNames.forEach(function (paramName, index) {
      params[paramName] = match[index + 1];
    });

    return params;
  },

  /**
   * Returns a version of the given route path with params interpolated. Throws
   * if there is a dynamic segment of the route path for which there is no param.
   */
  injectParams: function injectParams(pattern, params) {
    params = params || {};

    var _compilePattern3 = compilePattern(pattern);

    var tokens = _compilePattern3.tokens;

    var parenCount = 0,
        pathname = '',
        splatIndex = 0;

    var token, paramName, paramValue;
    for (var i = 0, len = tokens.length; i < len; ++i) {
      token = tokens[i];

      if (token === '*') {
        paramValue = Array.isArray(params.splat) ? params.splat[splatIndex++] : params.splat;

        invariant(paramValue != null || parenCount > 0, 'Missing splat #%s for path "%s"', splatIndex, pattern);

        if (paramValue != null) pathname += paramValue;
      } else if (token === '(') {
        parenCount += 1;
      } else if (token === ')') {
        parenCount -= 1;
      } else if (token.charAt(0) === ':') {
        paramName = token.substring(1);
        paramValue = params[paramName];

        invariant(paramValue != null || parenCount > 0, 'Missing "%s" parameter for path "%s"', paramName, pattern);

        if (paramValue != null) pathname += paramValue;
      } else {
        pathname += token;
      }
    }

    return pathname.replace(/\/+/g, '/');
  },

  /**
   * Returns an object that is the result of parsing any query string contained
   * in the given path, null if the path contains no query string.
   */
  extractQuery: function extractQuery(path) {
    var match = path.match(queryMatcher);
    return match && qs.parse(match[1]);
  },

  /**
   * Returns a version of the given path without the query string.
   */
  withoutQuery: function withoutQuery(path) {
    return path.replace(queryMatcher, '');
  },

  /**
   * Returns a version of the given path with the parameters in the given
   * query merged into the query string.
   */
  withQuery: function withQuery(path, query) {
    var existingQuery = PathUtils.extractQuery(path);

    if (existingQuery) query = query ? assign(existingQuery, query) : existingQuery;

    var queryString = qs.stringify(query, { arrayFormat: 'brackets' });

    if (queryString) return PathUtils.withoutQuery(path) + '?' + queryString;

    return PathUtils.withoutQuery(path);
  }

};

module.exports = PathUtils;