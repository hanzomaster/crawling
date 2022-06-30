const axios = require('axios').default
const cheerio = require('cheerio')
const XLSX = require('xlsx')

const crawl = async url => {
  const res = await axios.get(url, { validateStatus: () => true })
  const $ = cheerio.load(res.data)
  return $('a')
    .map((_i, link) => link.attribs.href)
    .get()
}

const articles = crawl('https://jprp.vn/index.php/JPRP/issue/archive')
  .then(url => {
    const issues = url.filter(link => link.includes('/JPRP/issue/view'))
    const articleLinks = issues.map(async link => {
      const links = await crawl(link)
      return links
        .filter(article => article.includes('/JPRP/article/view'))
        .filter(realArticle => {
          const check = realArticle.split('/').slice(-2)
          return isNaN(check[0])
        })
    })
    return Promise.all(articleLinks)
  })
  .catch(err => {
    console.log(err)
  })

articles.then(article => {
  const result = article.flat().map(async link => {
    const res = await axios.get(link, { validateStatus: () => true })
    const $ = cheerio.load(res.data)
    const name = $('header h2').text().trim()

    const article = $('a.title').attr('href')

    const date = $('div.date-published').text().trim()
    const datePublished = date.slice(date.lastIndexOf('\t') + 1)

    const DOI = $('div.doi a').attr('href')

    return {
      name,
      article,
      datePublished,
      DOI,
    }
  })

  Promise.all(result).then(data => {
    // convert to excel with xlsx
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'JPRP')
    XLSX.writeFile(wb, 'JPRP.xlsx')
  })
})
