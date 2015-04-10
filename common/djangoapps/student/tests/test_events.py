"""
Test that various events are fired for models in the student app.
"""
from django.test import TestCase

from student.tests.factories import UserFactory
from student.tests.test import EventTestMixin


class TestUserProfileEvents(EventTestMixin, TestCase):
    """
    Test that we fire field change events when UserProfile models are changed.

    DON'T FORGET UNICODE!
    """
    def __init__(self):
        super(TestUserProfileEvents).__init__(self)
        # create user, clear log
        pass

    def test_change_one_field(self):
        pass

    def test_change_many_fields(self):
        pass

    def test_unicode(self):
        pass
