import { useState } from 'react'
import Workbench from '../components/growth/Workbench'
import { PREVIEW_KEY, seedPreview, migratePreview } from '../lib/growthPreview'
function restore() {
  try {
    return migratePreview(JSON.parse(localStorage.getItem(PREVIEW_KEY)))
  } catch {
    return seedPreview()
  }
}
export default function GrowthPreview() {
  const [data, setData] = useState(restore)
  const update = (next) => {
    setData(next)
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(next))
  }
  return <Workbench data={data} onChange={update} />
}
