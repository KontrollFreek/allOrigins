const getPage = require('./get-page')
const getLogger = require('./logger')

const logger = getLogger(process.env.DEBUG && process.env.DEBUG !== '0')

const DEFAULT_CACHE_TIME = 60 * 60 // 60 minutes
const MIN_CACHE_TIME = 5 * 60 // 5 minutes

module.exports = processURLRequest

async function processURLRequest(req, res) {
  const startTime = new Date()
  const params = parseParams(req)

  if (params.requestMethod === 'OPTIONS') {
    return res.end()
  }

  const page = await getPage(params)

  return createResponse(page, params, res, startTime).then((resPage) => {
    logger.requestProcessed({
      format: params.format,
      headers: req.headers,
      status: {
        ...(typeof resPage.status !== 'object'
          ? {
              response_time: new Date() - startTime,
            }
          : resPage.status),
        url: params.url,
      },
    })
  })
}

function parseParams(req) {
  const params = {
    requestMethod: req.method,
    ...req.query,
    ...req.params,
    url: req.originalUrl.slice(5),
    baseURL: req.protocol + '://' + req.get('host')
  }
  params.requestMethod = parseRequestMethod(params.requestMethod)
  params.format = 'url'
  return params
}

function parseRequestMethod(method) {
  method = (method || '').toUpperCase()

  if (['HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'].includes(method)) {
    return method
  }
  return 'GET'
}

async function createResponse(page, params, res, startTime) {
  if (['GET', 'HEAD'].includes(params.requestMethod)) {
    const maxAge = params.disableCache
      ? 0
      : Math.max(
          MIN_CACHE_TIME,
          Number(params.cacheMaxAge) || DEFAULT_CACHE_TIME
        )

    res.set('Cache-control', `public, max-age=${maxAge}, stale-if-error=600`)
  }

  res.set({
    'Content-Length': page.contentLength,
    'Content-Type': page.contentType,
  })
  return res.send(page.content)
}
