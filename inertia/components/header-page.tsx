import { PlusIcon } from 'lucide-react'
import { Button } from './ui/button'

const HeaderPage = ({
  title,
  button,
  action,
}: {
  title: string
  button?: string
  action?: any
}) => {
  return (
    <>
      <div className="py-4 px-8 flex justify-between items-center">
        <h1>{title ?? 'Page sans nom'}</h1>
        {button && (
          <Button className="cursor-pointer" onClick={action}>
            <PlusIcon className="w-5 h-5" />
            {button}
          </Button>
        )}
      </div>
    </>
  )
}

export default HeaderPage
