import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '~/lib/utils'
import { Button } from '~/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '~/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'

interface Option {
  value: number
  label: string
  isSuggestion?: boolean
  color?: string
  icon?: string
}

interface ComboboxProps {
  options: Option[]
  value?: number
  onChange: (value: number) => void
  placeholder?: string
}

// Helper pour générer un fond pâle à partir d'une couleur hex
function getPaleBgColor(hex: string) {
  if (!hex || !hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) return '#f3f4f6'
  let r, g, b
  if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  } else {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  }
  return `rgba(${r},${g},${b},0.18)`
}

function CategoryBadge({ label, color, icon }: { label: string; color?: string; icon?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold border align-middle"
      style={{
        background: getPaleBgColor(color || '#eee'),
        color: color || '#333',
        borderColor: getPaleBgColor(color || '#eee'),
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </span>
  )
}

export function Combobox({ options, value, onChange, placeholder }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const selected = options.find((o) => o.value === value)
  console.log('Combobox options:', options)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="w-full cursor-pointer">
          {selected ? (
            <CategoryBadge label={selected.label} color={selected.color} icon={selected.icon} />
          ) : (
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold border align-middle text-gray-400 bg-gray-100 border-gray-200">
              {placeholder || 'Sélectionner...'}
            </span>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher..." />
          <CommandEmpty>Aucun résultat</CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.label.toLowerCase()}
                onSelect={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    value === option.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <CategoryBadge label={option.label} color={option.color} icon={option.icon} />
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
