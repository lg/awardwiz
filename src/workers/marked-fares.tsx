import { createClient } from "@supabase/supabase-js"
import type { Database } from "../types/supabase-types"
import { MarkedFare } from "../components/SearchResults"
import dayjs from "dayjs"

const supabase = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_SERVICE_KEY)

console.log("Getting all marked fares...")
const markedFaresQuery = await supabase
  .from("cloudstate")
  .select("user_id, value")
  .eq("key", "markedFares")
  .not("value", "eq", "[]")
if (markedFaresQuery.error) throw markedFaresQuery.error.message

console.log("Getting email addresses for users...")
const emailsQuery = await supabase
  .from("users_clone")
  .select("id, email")
  .in("id", markedFaresQuery.data.map(({ user_id }) => user_id))
if (emailsQuery.error) throw emailsQuery.error.message

// Add user id and email to each marked fare
let markedFares = markedFaresQuery.data.flatMap((item) => {
  const email = emailsQuery.data.find((user) => user.id === item.user_id)?.email as string
  return (item.value as MarkedFare[]).map((markedFare) => ({ ...markedFare, userId: item.user_id, email }))
})

// Remove all fares from the past
const toRemove = markedFares.filter((markedFare) => dayjs(markedFare.date).isBefore(dayjs().startOf("day")))
markedFares = markedFares.filter((markedFare) => !toRemove.includes(markedFare))

console.log(markedFares)

// TODO: check if fares are available
