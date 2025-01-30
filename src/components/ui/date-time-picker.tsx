import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
  value: Date
  onChange: (date: Date) => void
  placeholder?: string
}

export function DateTimePicker({ value, onChange, placeholder }: DateTimePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(value)
  const [timeInput, setTimeInput] = React.useState(format(value, "HH:mm"))

  // Update parent when date or time changes
  React.useEffect(() => {
    if (date) {
      const [hours, minutes] = timeInput.split(":").map(Number)
      const newDate = new Date(date)
      newDate.setHours(hours || 0)
      newDate.setMinutes(minutes || 0)
      onChange(newDate)
    }
  }, [date, timeInput, onChange])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP HH:mm") : placeholder || "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
        />
        <div className="p-3 border-t">
          <Input
            type="time"
            value={timeInput}
            onChange={(e) => setTimeInput(e.target.value)}
            className="w-full"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
} 