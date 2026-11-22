/** La forma di `src/json/esiti.json`: i nove casi da provare, raccontati. */
export type Scenario = {
  id: string
  title: string
  lead: string
  happens: string[]
  notHappens: string[]
  ok: string[]
  open: { eventId: string; objectKey: string }
}
