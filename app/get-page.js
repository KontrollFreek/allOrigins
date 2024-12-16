const { got } = require('./http-client')
const iconv = require('iconv-lite')

module.exports = getPage

function getPage({ url, format, requestMethod, charset, baseURL }) {
  if (format === 'info' || requestMethod === 'HEAD') {
    return getPageInfo(url)
  } else if (format === 'raw') {
    return getRawPage(url, requestMethod, charset)
  } else if (format === 'url') {
    return getURLPage(url, requestMethod, charset, baseURL)
  }

  return getPageContents(url, requestMethod, charset)
}

async function getPageInfo(url) {
  const { response, error } = await request(url, 'HEAD')
  if (error) return processError(error)

  return {
    url: url,
    content_type: response.headers['content-type'],
    content_length: +response.headers['content-length'] || -1,
    http_code: response.statusCode,
  }
}

async function getURLPage(url, requestMethod, charset, baseURL) {
  const response = await getRawPage(url, requestMethod, charset)
  console.log(response.contentType)
  if (response.contentType)
    if (!response.contentType.startsWith('text/html')) return response

  try {
    response.content = Buffer.from(
      response.content.toString()
        .replaceAll(/((?:href|src)=["']?)((?:https?:\/\/|\/)?)/gi, function (_, p1, p2) {
          switch (p2) {
            case '':
              p2 = url + '/'
              break
            case '/':
              p2 = new URL(url).origin + '/'
              break
          }
          return `${p1}${baseURL}/url/${p2}`
      })
    )
  } catch (e) { console.error('Couldn\'t parse', url) }

  return response
}

async function getRawPage(url, requestMethod, charset) {
  const { content, response, error } = await request(
    url,
    requestMethod,
    true,
    charset
  )
  if (error) return processError(error)

  const contentLength = Buffer.byteLength(content)
  return {
    content,
    contentType: response.headers['content-type'],
    contentLength,
  }
}

async function getPageContents(url, requestMethod, charset) {
  const { content, response, error } = await request(
    url,
    requestMethod,
    false,
    charset
  )
  if (error) return processError(error)

  const contentLength = Buffer.byteLength(content)
  return {
    contents: content.toString(),
    status: {
      url: url,
      content_type: response.headers['content-type'],
      content_length: contentLength,
      http_code: response.statusCode,
    },
  }
}

async function request(url, requestMethod, raw = false, charset = null) {
  try {
    const options = {
      method: requestMethod,
      decompress: !raw,
    }

    const response = await got(url, options)
    if (options.method === 'HEAD') return { response }

    return processContent(response, charset)
  } catch (error) {
    return { error }
  }
}

async function processContent(response, charset) {
  const res = { response: response, content: response.body }
  if (charset && iconv.encodingExists(charset)) {
    res.content = iconv.decode(res.content, charset)
  }
  return res
}

async function processError(e) {
  const { response } = e
  if (!response) return { contents: null, status: { error: e } }

  const { url, statusCode: http_code, headers, body } = response
  const contentLength = Buffer.byteLength(body)

  return {
    contents: body.toString(),
    status: {
      url,
      http_code,
      content_type: headers['content-type'],
      content_length: contentLength,
    },
  }
}
