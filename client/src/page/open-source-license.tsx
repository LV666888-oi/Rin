import { useLocation } from "wouter";

const LICENSE_TEXT = `MIT License

Copyright (c) 2024 Xeu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export function OpenSourceLicensePage() {
  const [, setLocation] = useLocation();

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8 sm:px-8">
      <button
        type="button"
        onClick={goBack}
        className="mb-10 inline-flex items-center gap-2 text-sm font-medium text-neutral-900 transition-opacity hover:opacity-60 dark:text-white"
      >
        <i className="ri-arrow-left-line text-lg" />
        Back
      </button>

      <header className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-3xl">
          Open Source Software License
        </h1>
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          License information for the Rin project.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
          Project Information
        </h2>

        <div className="space-y-3 text-sm text-neutral-500 dark:text-neutral-400">
          <p>Project Name: Rin</p>
          <p>Original Author: Xeu</p>
          <p>Copyright (c) 2024 Xeu</p>
          <p>License: MIT License</p>
        </div>
      </section>

      <section>
        <h2 className="mb-5 text-lg font-semibold text-neutral-900 dark:text-white">
          MIT License
        </h2>

        <pre className="whitespace-pre-wrap break-words rounded-xl border border-black/5 bg-neutral-100/70 p-5 font-mono text-xs leading-7 text-neutral-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-neutral-400 sm:p-7 sm:text-sm">
          {LICENSE_TEXT}
        </pre>
      </section>
    </main>
  );
}
