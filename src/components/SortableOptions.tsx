// @ts-nocheck
'use client'

import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Liste d'options de sondage réordonnables par drag & drop (desktop + tactile).
 * `items` : tableau de { id, value }. `onChange` reçoit le nouveau tableau.
 */

function SortableRow({ id, value, onChangeValue, onRemove, canRemove, placeholder }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: 'flex', gap: '0.4rem', alignItems: 'center',
  }
  return (
    <div ref={setNodeRef} style={style}>
      {/* Poignée de drag */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        style={{ background: 'none', border: 'none', cursor: 'grab', padding: '0.2rem', display: 'flex', flexShrink: 0, touchAction: 'none', color: '#2D2D2D', opacity: 0.35 }}
        title="Glisser pour réordonner"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>
      </button>
      <input
        value={value}
        onChange={e => onChangeValue(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, padding: '0.55rem 0.85rem', border: '2px solid #E8E3D9', borderRadius: '10px', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
      />
      {canRemove && (
        <button type="button" onClick={onRemove} style={{ background: 'none', border: '1px solid #E8E3D9', borderRadius: '8px', width: '38px', cursor: 'pointer', color: '#2D2D2D', opacity: 0.5, fontSize: '1.1rem', flexShrink: 0 }}>×</button>
      )}
    </div>
  )
}

export default function SortableOptions({ items, onChange, minItems = 2, placeholderPrefix = 'Option' }: {
  items: { id: string; value: string }[]
  onChange: (next: { id: string; value: string }[]) => void
  minItems?: number
  placeholderPrefix?: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((item, i) => (
            <SortableRow
              key={item.id}
              id={item.id}
              value={item.value}
              placeholder={`${placeholderPrefix} ${i + 1}`}
              canRemove={items.length > minItems}
              onChangeValue={(v: string) => onChange(items.map(it => it.id === item.id ? { ...it, value: v } : it))}
              onRemove={() => onChange(items.filter(it => it.id !== item.id))}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
