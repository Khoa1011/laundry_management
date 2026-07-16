(() => {
  try {
    const saved = localStorage.getItem('laundry.theme')
    document.documentElement.dataset.theme = saved === 'laundry-indigo' ? saved : 'laundry-teal'
  } catch {
    document.documentElement.dataset.theme = 'laundry-teal'
  }
})()
