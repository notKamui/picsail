import { createFileRoute } from '@tanstack/react-router'
import { Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { article, eyebrow, link, text, title } from '@/components/ui/typography'

export const Route = createFileRoute('/design')({
  head: () => ({
    meta: [{ title: 'Design' }],
  }),
  component: DesignPage,
})

const swatches = [
  ['background', 'bg-background'],
  ['foreground', 'bg-foreground'],
  ['card', 'bg-card'],
  ['primary', 'bg-primary'],
  ['secondary', 'bg-secondary'],
  ['muted', 'bg-muted'],
  ['accent', 'bg-accent'],
  ['destructive', 'bg-destructive'],
  ['border', 'bg-border'],
  ['ring', 'bg-ring'],
] as const

function DesignPage() {
  const [dark, setDark] = useState(false)

  return (
    <main className={`${dark ? 'dark' : ''} min-h-svh bg-background text-foreground`}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-6 py-12">
        <header className="flex items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <p className={eyebrow()}>Picsail</p>
            <h1 className={title({ h: 1 })}>Design</h1>
            <p className={text({ variant: 'muted' })}>
              Tokens, type, and the components used across the app.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={dark ? 'Use light appearance' : 'Use dark appearance'}
            onClick={() => setDark((value) => !value)}
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
        </header>

        <Section kicker="Color" heading="Palette">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {swatches.map(([name, color]) => (
              <li key={name} className="flex flex-col gap-2">
                <div className={`h-16 rounded-lg border border-border ${color}`} />
                <span className={text({ variant: 'small' })}>{name}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section kicker="Type" heading="Typography">
          <div className="flex flex-col gap-4">
            <h2 className={title({ h: 1 })}>A quiet place for pictures</h2>
            <h3 className={title({ h: 2 })}>Section</h3>
            <h4 className={title({ h: 3 })}>Subsection</h4>
            <h5 className={title({ h: 4 })}>Label</h5>
            <p className={text()}>Body copy stays on the foreground color.</p>
            <p className={text({ variant: 'muted' })}>Muted copy explains, it does not compete.</p>
            <p className={text({ variant: 'small', color: 'error' })}>Small error copy.</p>
            <a className={link()} href="#prose">
              A text link
            </a>
          </div>
          <div id="prose" className={article}>
            <h2>Prose</h2>
            <p>
              Long-form text uses the typography plugin. Links, <code>inline code</code>, and lists
              follow the same ink and border tokens.
            </p>
            <ul>
              <li>Still images</li>
              <li>Public hash URLs</li>
              <li>A delete code for each file</li>
            </ul>
          </div>
        </Section>

        <Section kicker="Actions" heading="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button">Primary</Button>
            <Button type="button" variant="secondary">
              Secondary
            </Button>
            <Button type="button" variant="outline">
              Outline
            </Button>
            <Button type="button" variant="ghost">
              Ghost
            </Button>
            <Button type="button" variant="destructive">
              Destructive
            </Button>
            <Button type="button" variant="link">
              Link
            </Button>
            <Button type="button" disabled>
              Disabled
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="xs">
              Extra small
            </Button>
            <Button type="button" size="sm">
              Small
            </Button>
            <Button type="button">Default</Button>
            <Button type="button" size="lg">
              Large
            </Button>
            <Button type="button" size="icon" aria-label="Icon">
              <Sun />
            </Button>
          </div>
        </Section>

        <Section kicker="Forms" heading="Fields">
          <Card>
            <CardHeader>
              <CardTitle className={title({ h: 3 })}>Upload details</CardTitle>
              <CardDescription>
                Labels sit above the field. Errors use the destructive color.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="design-name">Name</FieldLabel>
                  <Input id="design-name" placeholder="harbor.jpg" />
                  <FieldDescription>Shown next to the public URL.</FieldDescription>
                </Field>
                <Field data-invalid>
                  <FieldLabel htmlFor="design-email">Email</FieldLabel>
                  <Input id="design-email" defaultValue="not-an-email" aria-invalid />
                  <FieldError>Enter a valid email</FieldError>
                </Field>
                <FieldSeparator>or</FieldSeparator>
                <Field data-disabled>
                  <FieldLabel htmlFor="design-disabled">Disabled</FieldLabel>
                  <Input id="design-disabled" disabled placeholder="Unavailable" />
                </Field>
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end gap-3">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="button">Save</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section kicker="Layout" heading="Separator">
          <div className="flex h-10 items-center gap-4">
            <span className={text({ variant: 'small' })}>Left</span>
            <Separator orientation="vertical" />
            <span className={text({ variant: 'small' })}>Right</span>
          </div>
          <Separator />
        </Section>
      </div>
    </main>
  )
}

function Section({
  kicker,
  heading,
  children,
}: {
  kicker: string
  heading: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className={eyebrow()}>{kicker}</p>
        <h2 className={title({ h: 2 })}>{heading}</h2>
      </div>
      {children}
    </section>
  )
}
