export const isTextNameFile = (file) => {
  return file.type.match('text.*') || file.name.endsWith('.txt')
}

export const readTextFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = event => resolve(event.target.result)
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsText(file)
  })
}
