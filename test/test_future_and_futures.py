import imp
import os
import sys

# Import from kolibri first to ensure Kolibri's monkey patches are applied.
from kolibri import dist as kolibri_dist  # noreorder


dist_dir = os.path.realpath(os.path.dirname(kolibri_dist.__file__))


def test_import_concurrent_py3():
    import concurrent

    if sys.version_info[0] == 3:
        # Python 3 is supposed to import its builtin package `concurrent`
        # instead of being inside kolibri/dist/py2only or kolibri/dist
        concurrent_parent_path = os.path.realpath(
            os.path.dirname(os.path.dirname(concurrent.__file__))
        )

        assert dist_dir != concurrent_parent_path
        assert os.path.join(dist_dir, "py2only") != concurrent_parent_path


def test_import_future_py2():
    from future.standard_library import TOP_LEVEL_MODULES

    if sys.version_info[0] == 2:
        for module_name in TOP_LEVEL_MODULES:
            if "test" in module_name:
                continue

            module_parent_path = os.path.realpath(
                os.path.dirname(imp.find_module(module_name)[1])
            )
            # future's standard libraries such as `html` should not be found
            # at the same level as kolibri/dist; otherwise, python3 will try to
            # import them from kolibri/dist instead of its builtin packages
            assert dist_dir != module_parent_path
