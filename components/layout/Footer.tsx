'use client';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-4">
        <p className="text-center text-sm text-muted-foreground">
          {currentYear} CS & Company. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
